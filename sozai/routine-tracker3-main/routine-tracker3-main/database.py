from sqlmodel import SQLModel, create_engine, Session

# データベースファイル名
sqlite_file_name = "routine.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

# データベースエンジンの作成
# check_same_thread=FalseはFastAPIのようなスレッドを使うアプリでSQLiteを使う場合に必要
connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, echo=True, connect_args=connect_args)

def create_db_and_tables():
    """データベースとテーブルを作成する"""
    SQLModel.metadata.create_all(engine)

def get_session():
    """データベースセッションを取得する依存関係"""
    with Session(engine) as session:
        yield session
