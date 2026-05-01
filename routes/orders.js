const express = require("express")
const { PrismaClient } = require("@prisma/client")
const adminOnly = require("../middleware/admin")

const router = express.Router()
const prisma = new PrismaClient()

const ORDER_STATUSES = ["Pending", "Confirmed", "Preparing", "On the way", "Delivered", "Cancelled"]

// GET my orders
router.get("/my", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      include: {
        restaurant: { select: { id: true, name: true, image: true } },
        items: {
          include: {
            menuItem: { select: { id: true, name: true, price: true, image: true } }
          }
        }
      }
    })
    res.json(orders)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" })
  }
})

// GET all orders (admin only)
router.get("/all", adminOnly, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        restaurant: { select: { id: true, name: true } },
        items: {
          include: {
            menuItem: { select: { id: true, name: true, price: true } }
          }
        }
      }
    })
    res.json(orders)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" })
  }
})

// GET one order
router.get("/:id", async (req, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        id: parseInt(req.params.id),
        ...(req.userRole !== "admin" && { userId: req.userId })
      },
      include: {
        restaurant: { select: { id: true, name: true, image: true } },
        user: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            menuItem: { select: { id: true, name: true, price: true, image: true } }
          }
        }
      }
    })
    if (!order) return res.status(404).json({ error: "Order not found" })
    res.json(order)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch order" })
  }
})

// POST — place order
router.post("/", async (req, res) => {
  try {
    const { restaurantId, items, address, notes } = req.body

    if (!restaurantId || !items || !items.length || !address) {
      return res.status(400).json({ error: "Restaurant, items and address required" })
    }

    // verify all menu items exist and calculate total
    let total = 0
    const orderItems = []

    for (const item of items) {
      const menuItem = await prisma.menuItem.findFirst({
        where: { id: item.menuItemId, restaurantId, isAvailable: true }
      })
      if (!menuItem) {
        return res.status(400).json({ error: `Menu item ${item.menuItemId} not available` })
      }
      total += menuItem.price * item.quantity
      orderItems.push({
        menuItemId: menuItem.id,
        quantity: item.quantity,
        price: menuItem.price
      })
    }

    const order = await prisma.order.create({
      data: {
        userId: req.userId,
        restaurantId,
        total,
        address,
        notes,
        items: { create: orderItems }
      },
      include: {
        restaurant: { select: { id: true, name: true, image: true } },
        items: {
          include: {
            menuItem: { select: { id: true, name: true, price: true } }
          }
        }
      }
    })

    res.status(201).json(order)
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Failed to place order" })
  }
})

// PUT — update order status (admin only)
router.put("/:id/status", adminOnly, async (req, res) => {
  try {
    const { status } = req.body

    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid status" })
    }

    const order = await prisma.order.update({
      where: { id: parseInt(req.params.id) },
      data: { status },
      include: {
        restaurant: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            menuItem: { select: { id: true, name: true, price: true } }
          }
        }
      }
    })
    res.json(order)
  } catch (error) {
    res.status(500).json({ error: "Failed to update order status" })
  }
})

// DELETE — cancel order
router.delete("/:id", async (req, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId }
    })
    if (!order) return res.status(404).json({ error: "Order not found" })
    if (order.status !== "Pending") {
      return res.status(400).json({ error: "Can only cancel pending orders" })
    }
    await prisma.order.update({
      where: { id: parseInt(req.params.id) },
      data: { status: "Cancelled" }
    })
    res.json({ message: "Order cancelled" })
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel order" })
  }
})

module.exports = router