"""drop_unused_user_columns

Revision ID: b7e3d9a1c4f2
Revises: ca0b68c4f126
Create Date: 2026-11-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7e3d9a1c4f2'
down_revision: Union[str, None] = 'ca0b68c4f126'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('middle_name')
        batch_op.drop_column('updated_at')
        batch_op.drop_column('updated_at_dt')


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('updated_at_dt', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('updated_at', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('middle_name', sa.String(length=100), nullable=True))
