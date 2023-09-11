import express from "express";
import cors from "cors";

// %IMPORT_APIS%

const app = express();
const port = 3000;

app.use(cors());

app.get('/', (req, res) => {
  res.send('Hello World!')
})

// %MAP_APIS%

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})