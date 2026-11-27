import json

from extensions import db
from lib.quiz import normalize_question_shape

def _quiz_questions_for(quiz_id):
    """Returns the questions list for a quiz from the quiz_questions table, or None if none stored."""
    rows = QuizQuestionModel.query.filter_by(quiz_id=quiz_id).order_by(QuizQuestionModel.question_order).all()
    if not rows:
        return None
    return [normalize_question_shape(row.to_dict()) for row in rows]


def _collision_safe_question_id(raw_id, quiz_id, idx):
    """Returns a unique global question id: keeps the requested id when free, otherwise falls back to q-<quiz_id>-<idx>."""
    candidate = str(raw_id).strip() if raw_id else ""
    if candidate and db.session.get(QuizQuestionModel, candidate) is None:
        return candidate
    return f"q-{quiz_id}-{idx}"


def _replace_quiz_questions(quiz_id, questions):
    """Rebuilds the quiz_questions rows for a quiz from a question list (idempotent, transactional)."""
    QuizQuestionModel.query.filter_by(quiz_id=quiz_id).delete(synchronize_session=False)
    for idx, q in enumerate(questions or []):
        if not isinstance(q, dict):
            continue
        q = normalize_question_shape(q)
        options = q.get("options") or []
        letter = None
        if isinstance(q.get("correctAnswer"), int) and 0 <= q["correctAnswer"] < len(options):
            letter = "ABCD"[q["correctAnswer"]] if len(options) <= 4 else str(q["correctAnswer"])
        elif isinstance(q.get("correctAnswer"), str) and q["correctAnswer"] in "ABCD":
            letter = q["correctAnswer"]
        # Multi-answer questions store no single letter (column is CHAR(1));
        # grading reads the authoritative list from questions_json.
        row = QuizQuestionModel(
            question_id=_collision_safe_question_id(q.get("id") or "", quiz_id, idx),
            quiz_id=quiz_id,
            question=q.get("question", ""),
            choice_a=options[0] if len(options) > 0 else None,
            choice_b=options[1] if len(options) > 1 else None,
            choice_c=options[2] if len(options) > 2 else None,
            choice_d=options[3] if len(options) > 3 else None,
            correct_answer=letter,
            points=1,
            options_json=json.dumps(options) if options else None,
            topic_tag=q.get("topicTag") or q.get("topic"),
            blooms_level=q.get("bloomsLevel"),
            difficulty=q.get("difficulty"),
            explanation=q.get("explanation"),
            question_order=idx,
        )
        db.session.add(row)


def _merge_questions_json(questions, questions_json):
    """Merges QuizQuestionModel rows with the authoritative questions_json copy.

    The JSON copy fills gaps on the rows (legacy rows lack topicTag, explanation,
    etc.) and is authoritative for multi-answer correctAnswer lists (the rows'
    correct_answer column is CHAR(1) and stores no letter for those).
    """
    try:
        json_qs = json.loads(questions_json) or []
    except Exception:
        json_qs = []
    json_by_id = {str(jq.get("id")): jq for jq in json_qs if jq.get("id")}
    for pos, q in enumerate(questions):
        jq = json_by_id.get(str(q.get("id")))
        if jq is None and pos < len(json_qs):
            jq = json_qs[pos]
        if not isinstance(jq, dict):
            continue
        for key in ("question", "options", "explanation", "topicTag", "bloomsLevel", "difficulty"):
            if q.get(key) in (None, "") and jq.get(key) is not None:
                q[key] = jq[key]
        # type: the questions_json copy knows the producer's canonical type (the
        # quiz_questions rows have no type column), so surface it on the rows.
        if not q.get("type") and jq.get("type"):
            q["type"] = jq["type"]
        # correctAnswer: the questions_json copy is authoritative when it holds a
        # multi-answer list; otherwise rows fill gaps for legacy quizzes.
        if isinstance(jq.get("correctAnswer"), list):
            q["correctAnswer"] = jq["correctAnswer"]
        elif q.get("correctAnswer") in (None, ""):
            q["correctAnswer"] = jq.get("correctAnswer")
    return [normalize_question_shape(q) for q in questions]

class QuizModel(db.Model):
    __tablename__ = "quizzes"
    quiz_id = db.Column(db.String(64), primary_key=True)
    material_id = db.Column(db.String(64), db.ForeignKey("learning_materials.material_id", ondelete="SET NULL"), nullable=True)
    teacher_id = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(30), default="active")
    subject_id = db.Column(db.String(64), nullable=False)
    subject_name = db.Column(db.String(128), nullable=False)
    created_by_name = db.Column(db.String(128), nullable=False, default="Christian C. Barral, MIT")
    quiz_type = db.Column(db.String(32), default="teacher")
    questions_json = db.Column(db.Text, nullable=False)
    is_published = db.Column(db.Boolean, default=True)
    time_limit_minutes = db.Column(db.Integer, default=15)
    pass_percentage = db.Column(db.Integer, default=70)
    difficulty = db.Column(db.String(32), default="medium")
    attempts_allowed = db.Column(db.Integer, default=0)
    reveal_answers = db.Column(db.Boolean, default=True)
    deadline = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.String(64), nullable=False)

    def to_dict(self):
        qs = _quiz_questions_for(self.quiz_id)
        if qs is None:
            try: qs = json.loads(self.questions_json)
            except Exception: qs = []
        else:
            qs = _merge_questions_json(qs, self.questions_json)
        qs = [normalize_question_shape(q) for q in qs if isinstance(q, dict)]
        return {
            "id": self.quiz_id,
            "title": self.title,
            "description": self.description,
            "subjectId": self.subject_id,
            "subjectName": self.subject_name,
            "materialId": self.material_id,
            "createdById": self.teacher_id,
            "createdByName": self.created_by_name,
            "quizType": self.quiz_type,
            "questions": qs,
            "isPublished": self.is_published,
            "timeLimitMinutes": self.time_limit_minutes,
            "passPercentage": self.pass_percentage,
            "difficulty": self.difficulty,
            "attemptsAllowed": self.attempts_allowed or 0,
            "revealAnswers": True if self.reveal_answers is None else bool(self.reveal_answers),
            "deadline": self.deadline or "",
            "createdAt": self.created_at or ""
        }

class QuizQuestionModel(db.Model):
    __tablename__ = "quiz_questions"
    question_id = db.Column(db.String(64), primary_key=True)
    quiz_id = db.Column(db.String(64), db.ForeignKey("quizzes.quiz_id", ondelete="CASCADE"), nullable=False)
    question = db.Column(db.Text, nullable=False)
    choice_a = db.Column(db.String(255), nullable=True)
    choice_b = db.Column(db.String(255), nullable=True)
    choice_c = db.Column(db.String(255), nullable=True)
    choice_d = db.Column(db.String(255), nullable=True)
    correct_answer = db.Column(db.String(1), nullable=True)
    points = db.Column(db.Integer, default=1)
    options_json = db.Column(db.Text, nullable=True)
    topic_tag = db.Column(db.String(128), nullable=True)
    blooms_level = db.Column(db.String(32), nullable=True)
    difficulty = db.Column(db.String(32), nullable=True)
    explanation = db.Column(db.Text, nullable=True)
    question_order = db.Column(db.Integer, default=0)

    def to_dict(self):
        try: options = json.loads(self.options_json) if self.options_json else []
        except Exception: options = []
        return {
            "id": self.question_id,
            "question": self.question,
            "options": options,
            "correctAnswer": self.correct_answer or (0 if options else ""),
            "topicTag": self.topic_tag or "General Concepts",
            "bloomsLevel": self.blooms_level or "Understanding",
            "difficulty": self.difficulty or "medium",
            "explanation": self.explanation or "",
        }

class QuizAttemptModel(db.Model):
    __tablename__ = "quiz_attempts"
    attempt_id = db.Column(db.String(64), primary_key=True)
    quiz_id = db.Column(db.String(64), db.ForeignKey("quizzes.quiz_id", ondelete="CASCADE"), nullable=False)
    student_id = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    attempt_status = db.Column(db.String(30), default="Completed")
    score = db.Column(db.Float, nullable=False)
    time_taken = db.Column(db.Integer, default=300)
    submitted_at = db.Column(db.String(64), nullable=False)
    quiz_title = db.Column(db.String(256), nullable=False)
    student_name = db.Column(db.String(128), nullable=False)
    subject_id = db.Column(db.String(64), nullable=False)
    subject_name = db.Column(db.String(128), nullable=False)
    max_score = db.Column(db.Integer, nullable=False)
    percentage = db.Column(db.Float, nullable=False)
    passed = db.Column(db.Boolean, nullable=False)
    answers_json = db.Column(db.Text, nullable=False)
    weak_topics_json = db.Column(db.Text, nullable=True)
    strong_topics_json = db.Column(db.Text, nullable=True)

    def to_dict(self):
        try: ans = json.loads(self.answers_json)
        except Exception: ans = []
        try: wt = json.loads(self.weak_topics_json) if self.weak_topics_json else []
        except Exception: wt = []
        try: st = json.loads(self.strong_topics_json) if self.strong_topics_json else []
        except Exception: st = []
        return {
            "id": self.attempt_id,
            "quizId": self.quiz_id,
            "quizTitle": self.quiz_title,
            "studentId": self.student_id,
            "studentName": self.student_name,
            "subjectId": self.subject_id,
            "subjectName": self.subject_name,
            "score": self.score,
            "maxScore": self.max_score,
            "totalPoints": self.max_score,
            "percentage": self.percentage,
            "passed": self.passed,
            "timeTaken": self.time_taken,
            "answers": ans,
            "submittedAt": self.submitted_at or "",
            "feedback": ans,
            "weakTopics": wt,
            "strongTopics": st,
            "completedAt": self.submitted_at or ""
        }
