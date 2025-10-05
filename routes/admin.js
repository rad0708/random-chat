import express from 'express';
import jwt from 'jsonwebtoken';
import Chat from '../models/Chat.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
const router = express.Router();
function requireAdmin(req,res,next){
  try{
    const token = req.headers.authorization?.split(' ')[1];
    if(!token) return res.status(401).json({error:'no token'});
    const p = jwt.verify(token, process.env.JWT_SECRET);
    if(!p.isAdmin) return res.status(403).json({error:'forbidden'});
    next();
  }catch(e){ res.status(401).json({error:'invalid token'}); }
}
router.get('/stats', requireAdmin, async (req,res)=>{
  const [users, rooms, reports] = await Promise.all([
    User.countDocuments(),
    Chat.countDocuments(),
    Report.countDocuments()
  ]);
  res.json({ users, rooms, reports });
});
export default router;