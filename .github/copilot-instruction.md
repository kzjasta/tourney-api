# tourney-api

This project is an API used for creating leagues and tournaments for volleyball. The user of this API is able to create volleyball teams and populated those teams with players. The user is then able to create leagues or tournaments and populated them with teams.

The teams in these competitions will then compete in fixtures against eachother. The results of these fixtures will be used to keep an updated state of a league or tournament.

## Tech stack in use

### Backend

- Node, Typescript, Express and Mongoose are used for the API
- Data is stored in MongoDB Atlas
  - There are separate database for dev and prod
  - For end to end testing, a new database is created and populated,
    then removed after tests are complete.
