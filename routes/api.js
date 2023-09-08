

const express = require("express")
const router = express.Router()
const baseRoutes = require("./userApi.js")

router.use("/",baseRoutes)

module.exports= router