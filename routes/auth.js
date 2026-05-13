const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { PrismaClient } = require("@prisma/client")

const router = express.Router()
const prisma = new PrismaClient()


const authenticate = require("../middleware/auth")

// GET my profile
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, phone: true, address: true, role: true }
    })
    res.json(user)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" })
  }
})

// PUT — update profile
router.put("/me", authenticate, async (req, res) => {
  try {
    const { name, phone, address } = req.body
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name, phone, address },
      select: { id: true, email: true, name: true, phone: true, address: true, role: true }
    })
    res.json(user)
  } catch (error) {
    res.status(500).json({ error: "Failed to update profile" })
  }
})

// Register
router.post("/register", async (req, res) => {
  try {
    const { email, password, name, phone } = req.body

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password and name required" })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(400).json({ error: "Email already registered" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, phone }
    })

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    )

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    })
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Registration failed" })
  }
})

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    )

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    })
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Login failed" })
  }
})

module.exports = router