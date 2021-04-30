import dotenv from "dotenv";
dotenv.config()

export const config = {
  dbUrl: `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.iw6md.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`
}