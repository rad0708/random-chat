import express from 'express';
import jwt from 'jsonwebtoken';
import Chat from '../models/Chat.js';
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
router.get('/room/:roomId', requireAdmin, async (req,res)=>{
  const doc = await Chat.findOne({ roomId: req.params.roomId });
  if(!doc) return res.status(404).json({error:'not found'});
  res.json(doc);
});
export default router;