import { ArrowRight, BookOpen, Download, FileText, Filter, Sparkles, Trash2, Upload } from "lucide-react";
import { Pagination, slicePage } from "../../../components/Pagination";
import type { LearningMaterial, Subject, User } from "../../../types";

interface MaterialsCatalogProps {
  materials: LearningMaterial[];
  subjects: Subject[];
  selectedSubject: string;
  currentUser: User | null;
  materialPage: number;
  onSubjectChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPreview: (material: LearningMaterial) => void;
  onDelete: (material: LearningMaterial) => void;
  onDownload: (material: LearningMaterial) => void;
  onDownloadAsPdf: (material: LearningMaterial) => void;
  onAssignSubject: (material: LearningMaterial) => void;
  onUpload: () => void;
  onAiNotes: () => void;
}

export function MaterialsCatalog({
  materials,
  subjects,
  selectedSubject,
  currentUser,
  materialPage,
  onSubjectChange,
  onPageChange,
  onPreview,
  onDelete,
  onDownload,
  onDownloadAsPdf,
  onAssignSubject,
  onUpload,
  onAiNotes,
}: MaterialsCatalogProps) {
  return (
    <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="inline-flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border w-fit max-w-full overflow-x-auto shrink-0">
          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap bg-card text-foreground shadow-xs border border-border">
            All Materials ({materials.length})
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto min-w-0">
          <div className="flex items-center space-x-2 w-full sm:w-auto min-w-0">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select
              value={selectedSubject}
              onChange={(e) => {
                onSubjectChange(e.target.value);
                onPageChange(1);
              }}
              className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-muted text-foreground font-medium focus:outline-none w-full sm:w-auto min-w-0 max-w-full"
            >
              <option value="all">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {currentUser?.role === "teacher" && (
              <button
                onClick={onUpload}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center space-x-2 border border-slate-700 cursor-pointer shrink-0 w-full sm:w-auto"
                title="Upload a course material for your students"
              >
                <Upload className="w-4 h-4 text-indigo-300" />
                <span>Upload Material</span>
              </button>
            )}

            {(currentUser?.role === "student" || currentUser?.role === "teacher") && (
              <button
                onClick={onAiNotes}
                className="px-4 py-2.5 bg-cta-gradient hover:brightness-110 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer shrink-0 w-full sm:w-auto"
                title="Generate study notes from your materials with AI"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>AI Notes Generator</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {materials.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
          <p className="text-sm font-bold text-foreground">No materials found in this section</p>
          <p className="text-xs text-muted-foreground">Try selecting "All Subjects" in the filter above.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {slicePage(materials, materialPage).map((mat) => {
              const canAssignSubject =
                currentUser?.role === "teacher" &&
                mat.uploaderId === currentUser?.id &&
                mat.uploaderRole !== "student";
              const canDelete =
                currentUser?.role !== "admin" && mat.uploaderId === currentUser?.id;

              return (
                <div
                  key={mat.id}
                  onClick={() => onPreview(mat)}
                  className="p-4 rounded-xl border border-border transition-all space-y-3 flex flex-col justify-between bg-card hover:border-primary/40 cursor-pointer"
                  title="Click to view this material"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      {mat.subjectName && (
                        <span className="px-2 py-0.5 rounded-md bg-structure text-primary dark:text-indigo-300 font-mono text-[10px] font-bold uppercase tracking-wider border border-structure-strong">
                          {mat.subjectName}
                        </span>
                      )}

                      <div className="flex items-center space-x-1.5">
                        {canDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(mat);
                            }}
                            className="text-muted-foreground hover:text-rose-600 transition-colors p-1.5 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                            title="Delete Material"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-foreground line-clamp-1">{mat.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">{mat.description}</p>
                  </div>

                  <div className="pt-3 border-t border-border space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                      {mat.fileSize ? (
                        <span className="flex items-center gap-1 font-mono" title="File size">
                          <FileText className="w-3 h-3" />
                          {mat.fileSize}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span>{new Date(mat.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 pt-1">
                      {(() => {
                        const ext = (mat.fileType || "").toLowerCase().replace(/^\./, "");
                        const baseCls =
                          "py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center space-x-1 cursor-pointer border border-slate-700";
                        if (ext === "doc" || ext === "docx") {
                          return (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDownload(mat);
                                }}
                                className={baseCls}
                                title="Download the original Word file"
                              >
                                <Download className="w-3 h-3 text-emerald-400" />
                                <span>Download DOCX</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDownloadAsPdf(mat);
                                }}
                                className={baseCls}
                                title="Download as PDF"
                              >
                                <Download className="w-3 h-3 text-emerald-400" />
                                <span>Download as PDF</span>
                              </button>
                            </>
                          );
                        }
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownload(mat);
                            }}
                            className={baseCls}
                            title="Download this material"
                          >
                            <Download className="w-3 h-3 text-emerald-400" />
                            <span>
                              {ext === "pdf" ? "Download PDF" : `Download ${ext.toUpperCase()}`}
                            </span>
                          </button>
                        );
                      })()}
                    </div>

                    {canAssignSubject && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssignSubject(mat);
                        }}
                        className="w-full py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center space-x-1 cursor-pointer border border-indigo-500/20"
                        title={mat.subjectId ? "Change the assigned subject" : "Assign this material to an assigned subject"}
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>{mat.subjectId ? "Change Subject" : "Assign Subject"}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination
            page={materialPage}
            total={materials.length}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  );
}
