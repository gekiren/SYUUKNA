from sqlmodel import Session, select
from database import engine, create_db_and_tables
from models import Routine, Task

def create_sample_data():
    create_db_and_tables()
    with Session(engine) as session:
        # 既存データ確認
        existing = session.exec(select(Routine)).first()
        if existing:
            print("Already has data.")
            return

        # サンプルルーティン作成
        morning = Routine(name="朝の支度")
        session.add(morning)
        session.commit()
        session.refresh(morning)

        t1 = Task(name="顔を洗う", order=1, estimated_seconds=180, routine_id=morning.id) # 3分
        t2 = Task(name="コーヒーを淹れる", order=2, estimated_seconds=300, routine_id=morning.id) # 5分
        t3 = Task(name="メールチェック", order=3, estimated_seconds=600, routine_id=morning.id) # 10分
        
        session.add(t1)
        session.add(t2)
        session.add(t3)
        session.commit()
        print("Sample data created!")

if __name__ == "__main__":
    create_sample_data()
