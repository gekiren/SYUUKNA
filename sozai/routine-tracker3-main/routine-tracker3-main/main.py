from typing import List
from fastapi import FastAPI, Depends, HTTPException
from sqlmodel import Session, select
from database import create_db_and_tables, get_session
from models import (
    Routine, RoutineCreate, RoutineRead,
    Task, TaskCreate, TaskRead,
    RoutineCompletion, RoutineCreateWithTasks
)
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    return FileResponse("templates/index.html")

# 起動時にデータベースを作成
@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# ルーティン一覧取得
@app.get("/routines/", response_model=List[RoutineRead])
def read_routines(session: Session = Depends(get_session)):
    routines = session.exec(select(Routine)).all()
    return routines

# ルーティンとタスクをまとめて作成
@app.post("/routines/with-tasks/", response_model=RoutineRead)
def create_routine_with_tasks(
    routine_with_tasks: RoutineCreateWithTasks, 
    session: Session = Depends(get_session)
):
    # 1. ルーティン作成
    # tasksフィールドはRelationshipのため、Createモデルから直接入れるとエラーになる場合がある
    # そのため、明示的にtasksを除外して作成する
    routine_data = routine_with_tasks.dict(exclude={"tasks"})
    db_routine = Routine(**routine_data)
    
    session.add(db_routine)
    session.commit()
    session.refresh(db_routine)
    
    # 2. タスク作成
    for task_data in routine_with_tasks.tasks:
        db_task = Task.from_orm(task_data)
        db_task.routine_id = db_routine.id
        session.add(db_task)
    
    session.commit()
    session.refresh(db_routine)
    return db_routine

# 新しいルーティン作成
@app.post("/routines/", response_model=RoutineRead)
def create_routine(routine: RoutineCreate, session: Session = Depends(get_session)):
    db_routine = Routine.from_orm(routine)
    session.add(db_routine)
    session.commit()
    session.refresh(db_routine)
    return db_routine

# ルーティンにタスクを追加
@app.post("/routines/{routine_id}/tasks/", response_model=TaskRead)
def create_task_for_routine(
    routine_id: int, 
    task: TaskCreate, 
    session: Session = Depends(get_session)
):
    routine = session.get(Routine, routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    
    db_task = Task.from_orm(task)
    db_task.routine_id = routine_id
    session.add(db_task)
    session.commit()
    session.refresh(db_task)
    return db_task

# 特定のルーティン取得（タスク含む）
@app.get("/routines/{routine_id}", response_model=RoutineRead)
def read_routine(routine_id: int, session: Session = Depends(get_session)):
    routine = session.get(Routine, routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    return routine

# ルーティン完了時の処理（時間の更新）
@app.post("/routines/{routine_id}/complete")
def complete_routine(
    routine_id: int, 
    completion: RoutineCompletion, 
    session: Session = Depends(get_session)
):
    routine = session.get(Routine, routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    
    updated_tasks = []
    
    for log in completion.task_logs:
        task = session.get(Task, log.task_id)
        if task and task.routine_id == routine_id:
            # 時間の更新ロジック: 元の想定 * 0.7 + 今回の実績 * 0.3
            old_est = task.estimated_seconds
            actual = log.actual_seconds
            new_est = int(old_est * 0.7 + actual * 0.3)
            
            task.estimated_seconds = new_est
            session.add(task)
            updated_tasks.append({
                "task_name": task.name,
                "old_est": old_est,
                "new_est": new_est,
                "actual": actual
            })
    
    session.commit()
    return {"message": "Routine updated", "updates": updated_tasks}

# ルーティンの削除
@app.delete("/routines/{routine_id}")
def delete_routine(routine_id: int, session: Session = Depends(get_session)):
    routine = session.get(Routine, routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    
    # 関連するタスクを削除
    tasks = session.exec(select(Task).where(Task.routine_id == routine_id)).all()
    for t in tasks:
        session.delete(t)
        
    session.delete(routine)
    session.commit()
    return {"message": "Routine deleted"}

# ルーティンの更新（編集）
@app.put("/routines/{routine_id}", response_model=RoutineRead)
def update_routine(
    routine_id: int,
    routine_with_tasks: RoutineCreateWithTasks,
    session: Session = Depends(get_session)
):
    db_routine = session.get(Routine, routine_id)
    if not db_routine:
        raise HTTPException(status_code=404, detail="Routine not found")
        
    # 名前の更新
    db_routine.name = routine_with_tasks.name
    session.add(db_routine)
    
    # 既存タスクの全削除
    existing_tasks = session.exec(select(Task).where(Task.routine_id == routine_id)).all()
    for t in existing_tasks:
        session.delete(t)
        
    # 新しいタスクの作成
    for task_data in routine_with_tasks.tasks:
        db_task = Task.from_orm(task_data)
        db_task.routine_id = routine_id
        session.add(db_task)
        
    session.commit()
    session.refresh(db_routine)
    return db_routine
