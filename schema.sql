-- مخطط قاعدة بيانات خَلّد (D1)
CREATE TABLE IF NOT EXISTS questions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cat TEXT, p INTEGER, q TEXT, a TEXT,
  by_user TEXT, created INTEGER, approved INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS scores(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game TEXT, name TEXT, score INTEGER, by_user TEXT, created INTEGER
);
CREATE TABLE IF NOT EXISTS users(
  sub TEXT PRIMARY KEY, name TEXT, email TEXT, picture TEXT, created INTEGER
);
