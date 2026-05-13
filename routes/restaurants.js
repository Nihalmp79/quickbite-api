const express = require("express")
const { PrismaClient } = require("@prisma/client")
const adminOnly = require("../middleware/admin")

const router = express.Router()
const prisma = new PrismaClient()

// GET all restaurants
router.get("/", async (req, res) => {
  try {
    const { category, search } = req.query

    const where = {}
    if (category) where.category = category
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } }
      ]
    }

    const restaurants = await prisma.restaurant.findMany({
      where,
      orderBy: { rating: "desc" }
    })
    res.json(restaurants)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch restaurants" })
  }
})

// GET one restaurant with menu
router.get("/:id", async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        menuItems: {
          where: { isAvailable: true },
          orderBy: { category: "asc" }
        }
      }
    })
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" })
    res.json(restaurant)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch restaurant" })
  }
})

// POST — create restaurant (admin only)
router.post("/", adminOnly, async (req, res) => {
  try {
    const { name, description, image, category, deliveryTime, minOrder } = req.body
    if (!name || !category) {
      return res.status(400).json({ error: "Name and category required" })
    }
    const restaurant = await prisma.restaurant.create({
      data: { name, description, image, category, deliveryTime, minOrder }
    })
    res.status(201).json(restaurant)
  } catch (error) {
    res.status(500).json({ error: "Failed to create restaurant" })
  }
})

// POST — add menu item (admin only)
router.post("/:id/menu", adminOnly, async (req, res) => {
  try {
    const { name, description, price, image, category } = req.body
    if (!name || !price) {
      return res.status(400).json({ error: "Name and price required" })
    }
    const menuItem = await prisma.menuItem.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        image,
        category,
        restaurantId: parseInt(req.params.id)
      }
    })
    res.status(201).json(menuItem)
  } catch (error) {
    res.status(500).json({ error: "Failed to create menu item" })
  }
})
// PUT — update restaurant (admin only)
router.put("/:id", adminOnly, async (req, res) => {
  try {
    const { name, description, image, category, deliveryTime, minOrder, isOpen } = req.body
    const restaurant = await prisma.restaurant.update({
      where: { id: parseInt(req.params.id) },
      data: { name, description, image, category, deliveryTime, minOrder, isOpen }
    })
    res.json(restaurant)
  } catch (error) {
    res.status(500).json({ error: "Failed to update restaurant" })
  }
})

// POST — rate restaurant (only if ordered from it)
router.post("/:id/rate", async (req, res) => {
  try {
    const { rating, comment } = req.body
    const restaurantId = parseInt(req.params.id)

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" })
    }

    // check if user has ordered from this restaurant
    const order = await prisma.order.findFirst({
      where: {
        userId: req.userId,
        restaurantId,
        status: "Delivered"
      }
    })
    if (!order) {
      return res.status(400).json({ error: "You can only rate restaurants you have ordered from" })
    }

    // upsert — create or update rating
    const newRating = await prisma.rating.upsert({
      where: { userId_restaurantId: { userId: req.userId, restaurantId } },
      update: { rating, comment },
      create: { rating, comment, userId: req.userId, restaurantId }
    })

    // update restaurant average rating
    const ratings = await prisma.rating.findMany({ where: { restaurantId } })
    const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length

    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { rating: Math.round(avg * 10) / 10 }
    })

    res.json(newRating)
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Failed to rate restaurant" })
  }
})

// GET ratings for a restaurant
router.get("/:id/ratings", async (req, res) => {
  try {
    const ratings = await prisma.rating.findMany({
      where: { restaurantId: parseInt(req.params.id) },
      include: {
        user: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    })
    res.json(ratings)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch ratings" })
  }
})

// PUT — update menu item (admin only)
router.put("/menu/:id", adminOnly, async (req, res) => {
  try {
    const { name, description, price, image, category, isAvailable } = req.body
    const menuItem = await prisma.menuItem.update({
      where: { id: parseInt(req.params.id) },
      data: { name, description, price: parseFloat(price), image, category, isAvailable }
    })
    res.json(menuItem)
  } catch (error) {
    res.status(500).json({ error: "Failed to update menu item" })
  }
})

// DELETE — delete restaurant (admin only)
router.delete("/:id", adminOnly, async (req, res) => {
  try {
    await prisma.restaurant.delete({ where: { id: parseInt(req.params.id) } })
    res.json({ message: "Restaurant deleted" })
  } catch (error) {
    res.status(500).json({ error: "Failed to delete restaurant" })
  }
})

module.exports = router