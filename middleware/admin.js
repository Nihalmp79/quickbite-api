const adminOnly = (req , res , next) => {
    if(req.userRole !== "admin"){
        return res.status(403).json({ error : "admin access required"})
    }

    next()
}

module.exports = adminOnly