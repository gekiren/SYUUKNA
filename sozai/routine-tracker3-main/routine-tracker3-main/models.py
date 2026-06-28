from typing import List, Optional
from sqlmodel import Field, Relationship, SQLModel

# --- ルーティン (Routine) ---

class RoutineBase(SQLModel):
    name: str = Field(index=True, description="ルーティンの名前（例：朝の支度）")

class Routine(RoutineBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    # ルーティンに紐づくタスク一覧
    tasks: List["Task"] = Relationship(back_populates="routine")

class RoutineCreate(RoutineBase):
    pass

class RoutineRead(RoutineBase):
    id: int
    tasks: List["TaskRead"] = []

# --- タスク (Task) ---

class TaskBase(SQLModel):
    name: str = Field(description="作業名（例：コーヒーを淹れる）")
    order: int = Field(default=0, description="表示順")
    estimated_seconds: int = Field(default=300, description="想定所要時間(秒)")

class Task(TaskBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    routine_id: Optional[int] = Field(default=None, foreign_key="routine.id")
    # タスクが属するルーティン
    routine: Optional[Routine] = Relationship(back_populates="tasks")

class TaskCreate(TaskBase):
    pass

class TaskRead(TaskBase):
    id: int

class RoutineCreateWithTasks(RoutineBase):
    tasks: List[TaskCreate]



# --- 実行結果の更新用モデル ---

class TaskLog(SQLModel):
    task_id: int
    actual_seconds: int

class RoutineCompletion(SQLModel):
    task_logs: List[TaskLog]

# Forward referenceの更新
RoutineRead.update_forward_refs()
