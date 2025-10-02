const express = require('express')
const cors = require('cors')
const path = require('path')
const bodyParser = require('body-parser')
const jwt = require('jsonwebtoken');
const multer  = require('multer')
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix)
  }
})
const upload = multer({ storage: storage })
const app = express()
app.use('/uploads',express.static(path.join(__dirname,'uploads')));
app.use(cors());
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
const port = 4000
const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/');

const Users = mongoose.model('Users', {
  username: String, 
  mobile: String, 
  email: String, 
  password: String,
  LikedPlants:[{type:mongoose.Schema.Types.ObjectId,ref:'Plants'}]
});

let schema= new mongoose.Schema( { 
  pname: String, 
  pdesc: String,
  category: String,
  pimage:String,
  pimage2:String,
  addedBy:mongoose.Schema.Types.ObjectId,
  pLoc:{
    type:{
      type:String,
      enum:['Point'],
      default:'Point'
    },
    coordinates:{
      type:[Number],
      
    }
  }
})
schema.index({pLoc:'2dsphere'})
const Plants = mongoose.model('Plants',schema);


app.get('/', (req, res) => {
  res.send('Hello World!')
})
 
app.get('/search',(req,res)=>{
  let latitude = req.query.loc.split(',')[0]
  let longitude = req.query.loc.split(',')[1]
  let search=req.query.search;
  Plants.find({
    $or:[
      {pname:{$regex:search}},
      {pdesc:{$regex:search}},
      {category:{$regex:search}},
    ],

    pLoc:{
      $near:{
        $geometry:{
          type:'Point',
          coordinates:[parseFloat(latitude),parseFloat(longitude)]
        },
        $maxDistance:10000,
      }
    }

  })
  .then((result)=>{
    res.send({message: 'success', Plants : result})
  })
  .catch((err)=>{
  res.send({message: 'server err'})
  })
})


app.post('/like-Plant',(req,res)=>{
  let plantID= req.body.plantID;
  let userID= req.body.userID;
  Users.updateOne({ _id: userID },{  $addToSet:{LikedPlants:plantID}})
  .then(() =>{ 
    res.send({message : 'Plant Added to Wishlist.'})
    })
   .catch(()=>{
    res.send({message: 'server err'})
   })
})

app.post('/dislike-Plant',(req,res)=>{
  let plantID= req.body.plantID;
  let userID= req.body.userID;
  Users.updateOne({ _id: userID },{  $pull:{LikedPlants:plantID}})
  .then(() =>{ 
    res.send({message : 'Plant Removed from Wishlist.'})
    })
   .catch(()=>{
    res.send({message: 'server err'})
   })
})

app.post('/add-plant',upload.fields([{name:'pimage'},{name:'pimage2'}]), (req,res)=>{
 const plat = req.body.plat;
 const plong = req.body.plong;
 const pname = req.body.pname; 
 const pdesc = req.body.pdesc;
 const category = req.body.category;
 const pimage = req.files.pimage[0].path;
 const pimage2 = req.files.pimage2[0].path;
 const addedBy = req.body.userID;
 const Plant = new Plants({ pname,pdesc,category,pimage,pimage2,addedBy,pLoc:{
  type: 'Point',coordinates:[plat,plong]
 }});
 Plant.save()
      .then(() =>{ 
      res.send({message : 'saved success.'})
      })
     .catch(()=>{
      res.send({message: 'server err'})
     })
 return;
})

app.post('/edit-plant', upload.fields([{ name: 'pimage' }, { name: 'pimage2' }]), (req, res) => {
  const pid = req.body.pid;
  const pname = req.body.pname;
  const pdesc = req.body.pdesc;
  const category = req.body.category;

  let pimage = '';
  let pimage2 = '';

  if (req.files && req.files.pimage && req.files.pimage.length > 0) {
      pimage = req.files.pimage[0].path;
  }

  if (req.files && req.files.pimage2 && req.files.pimage2.length > 0) {
      pimage2 = req.files.pimage2[0].path;
  }

  let editObj = {};
  if (pname) editObj.pname = pname;
  if (pdesc) editObj.pdesc = pdesc;
  if (category) editObj.category = category;
  if (pimage) editObj.pimage = pimage;
  if (pimage2) editObj.pimage2 = pimage2;

  Plants.updateOne({ _id: pid }, { $set: editObj }, { returnDocument: "after" })
      .then((result) => {
          res.send({ message: 'Saved successfully.', plant: result });
      })
      .catch((err) => {
          console.error(err);
          res.status(500).send({ message: 'Server error' });
      });
});


app.get('/get-plants',(req,res)=>{

  const catName = req.query.catName;
  let _f={}
  if(catName){
    _f = {category:catName}
  }
  Plants.find(_f)
  .then((result)=>{

      res.send({message: 'success', Plants : result})
  })
  .catch((err)=>{
    res.send({message: 'server err'})
  })
})

app.post('/delete-plant',(req,res)=>{

  Plants.findOne({_id:req.body.pid})
  .then((result)=>{
    if(result.addedBy==req.body.userID){
      Plants.deleteOne({_id:req.body.pid})
      .then((deleteResult)=>{
        if(deleteResult.acknowledged){
          res.send({message:'Deleted Successfully'})
        }
      })
    }
  })
  .catch((err)=>{
    res.send({message: 'server err'})
  })
  return
})

app.get('/get-plant/:pid',(req,res)=>{
  Plants.findOne({_id : req.params.pid})
  .then((result)=>{

      res.send({message: 'success', Plants : result})
  })
  .catch((err)=>{
    res.send({message: 'server err'})
  })
})

app.post('/liked-plants',(req,res)=>{
  Users.findOne({_id:req.body.userID}).populate('LikedPlants')
  .then((result)=>{
      res.send({message: 'success', Plants : result.LikedPlants})
  })
  .catch((err)=>{
    res.send({message: 'server err'})
  })
})

app.post('/my-plants',(req,res)=>{
  const userID= req.body.userID
  Plants.find({addedBy:userID})
  .then((result)=>{
      res.send({message: 'success', Plants : result})
  })
  .catch((err)=>{
    res.send({message: 'server err'})
  })
})


app.post('/signup', (req,res)=>{
    const username = req.body.username;
    const password = req.body.password;
    const mobile = req.body.mobile;
    const email = req.body.email;
    const user = new Users({ username: username, password: password,mobile:mobile,email:email });
    user.save().
      then(() =>{ 
      res.send({message : 'Signup success you can login.'})
      })
     .catch(()=>{
      res.send({message: 'server err'})
     })
})

app.get('/get-user/:uId',(req,res)=>{
  const _userID=req.params.uId;
  Users.findOne({_id:_userID})
  .then((result) =>{ 
    res.send({message : ' Success',user:{
      email:result.email,
      mobile:result.mobile,
      username:result.username}})
    })
   .catch(()=>{
    res.send({message: 'server err'})
   })
})

app.post('/login', (req,res)=>{
    const username = req.body.username;
    const password = req.body.password;
    Users.findOne({username:username})
      .then((result) =>{ 
        if(!result){
          res.send({message:'User not found'})
        }else{
          if(result.password==password){
            const token =jwt.sign({
              data: result
            }, 'MYKEY', { expiresIn: '1h' });
            res.send({message : 'LogIn success.',token:token, userID:result._id})
          }
          if(result.password!=password){
            res.send({message : 'password Wrong'})
          } 
        }
      })
     .catch(()=>{
      res.send({message: 'server err'})
     })
})
app.get('/my-profile/:userId',(req,res)=>{
  let uid = req.params.userId;
  Users.findOne({_id : uid})
  .then((result) =>{ 
    res.send({message : ' Success',user:{
      email:result.email,
      mobile:result.mobile,
      username:result.username}})
    })
   .catch(()=>{
    res.send({message: 'server err'})
   })
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})