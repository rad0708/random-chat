import express from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import sanitize from 'mongo-sanitize';
import User from '../models/User.js';
const router = express.Router();
const sign = (u)=> jwt.sign({ uid: u._id, isAdmin: u.isAdmin }, process.env.JWT_SECRET, { expiresIn:'7d' });
router.post('/signup', async (req,res)=>{
  try{
    const username = sanitize(String(req.body.username||'').trim());
    const password = String(req.body.password||'');
    if(!username||!password) return res.status(400).json({error:'username and password required'});
    const exists = await User.findOne({ username });
    if(exists) return res.status(409).json({error:'username exists'});
    const passwordHash = await argon2.hash(password);
    const user = await User.create({ username, passwordHash });
    res.json({ token: sign(user) });
  }catch(e){ res.status(500).json({error:e.message}); }
});
router.post('/login', async (req,res)=>{
  try{
    const username = sanitize(String(req.body.username||'').trim());
    const password = String(req.body.password||'');
    const user = await User.findOne({ username });
    if(!user) return res.status(401).json({error:'invalid credentials'});
    const ok = await argon2.verify(user.passwordHash, password);
    if(!ok) return res.status(401).json({error:'invalid credentials'});
    res.json({ token: sign(user) });
  }catch(e){ res.status(500).json({error:e.message}); }
});
export default router;