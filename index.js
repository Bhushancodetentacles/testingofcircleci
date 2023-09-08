require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Moralis = require("moralis").default;
const { EvmChain } = require("@moralisweb3/common-evm-utils");

const app = express();

const PORT = process.env.PORT || 5000;

// middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

const api = require("./routes/api")

app.use("/", api);
// app.use("/test", api);

app.listen(PORT, () => {
  console.log("App is running at port: " + PORT);
});


// const startServer = async () => {
//     await Moralis.start({
//       apiKey: "ry2btIsX6JIUgDi4v2QwKZCxDmbPZxIoWNArbdOmr38iGez5looFIxLlKDBSbnio",
//     });
  
//     app.listen(PORT, () => {
//       console.log(`Example app listening on port ${PORT}`);
//     });
//   };
  
//   startServer();