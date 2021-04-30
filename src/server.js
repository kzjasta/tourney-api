import express from 'express'
import config from './config'
import { connect } from './utils/db.js'
import morgan from 'morgan'
import cors from 'cors'
import dotenv from "dotenv";

dotenv.config()

export const app = express()

app.use(cors())
app.use(morgan(':method :status :url - :response-time ms'))

export const start = async () => {
  try {
    await connect()
    app.listen(config.port, () => {
      console.log(`TOURNEY API RUNNING ON - http://localhost:${config.port}/api`)
    })
  } catch (e) {
    console.error(e)
  }
}