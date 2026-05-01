const express = require("express")
const cors = require("cors")
require("dotenv").config()

const authenticate = require("./middleware/auth")
const authRoutes = require("./routes/auth")
const restaurantRoutes = require("./routes/restaurants")
const orderRoutes = require("./routes/orders")

const app = express()
const PORT = process.env.PORT || 5003

app.use(cors())
app.use(express.json())

// public routes
app.use("/auth", authRoutes)

// public — anyone can view restaurants
app.use("/restaurants", authenticate, restaurantRoutes)

// protected — orders require auth
app.use("/orders", authenticate, orderRoutes)

app.get("/", (req, res) => {
  res.json({ message: "QuickBite API running!" })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})