const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const app = express();
const port = 8000;


app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(cookieParser())
app.use(express.static(path.join(__dirname,'public')))
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(cors());


mongoose.connect('mongodb://localhost:27017/login')
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.log(err));

// const userSchema = new mongoose.Schema({

//     fname: { type: String, required: true },
//     lname:{type: String, required: true},
//     email: { type: String, required: true, unique: true },
//     password: { type: String, required: true },
//     path : {type:[String]},
//     filename:{type:[String]},
//     realpath : {type:String},
// });

const userSchema = new mongoose.Schema({
    fName: { type: String, required: true },
    lName: { type: String, required: true },
    Acc_num: { type: String, required: true, unique: true },
    images: [{
        data: { type: String, required: true },   // Base64 string of the image data
        contentType: { type: String, required: true }  // MIME type of the image (e.g., image/png, image/jpeg)
      }],
      real_image: { 
        data: { type: String, required: true },   // Base64 string for the real image
        contentType: { type: String, required: true }  // MIME type for the real image
      }, // Base64 image data
      prediction: [{
        result: { type: String, required: true },  // Prediction result
        timestamp: { type: Date, required: true }  // Timestamp of when the prediction was made
    }],
});

const managerSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    managerid: { type: String, required: true, unique: true },  // A unique ID for the manager (could be email or another identifier)
    password: { type: String, required: true },
});

const Manager = mongoose.model('Manager', managerSchema);


// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//       cb(null, './uploads')
//     },
//     filename: function (req, file, cb) {
//       cb(null, Date.now() +' '+ file.originalname )
//     }
//   })


const storage = multer.memoryStorage(); // Use memoryStorage to keep file in memory

const uploadMultiple = multer({ storage: storage }).array('images', 10); // Allow up to 10 images

  
const upload = multer({ storage: storage })

const User = mongoose.model('User', userSchema);

const jwt=require('jsonwebtoken');
const { type } = require('os');
const { realpath } = require('fs');
const secret="7893218343"
function setUser(user) {
   
   return jwt.sign({
    id: user.id,
    username: user.fname,
    Acc_num:user.Acc_num,

},secret
);
}
function setManager(user) {
   
    return jwt.sign({
     id: user.id,
     mname:user.firstName,
     managerid: user.managerid,
 },secret
 );
 }
function getUser(token) {
    if (!token) return null;
    try {
        return jwt.verify(token, secret);
    } catch (err) {
        console.error("Invalid token:", err.message); // Log the error for debugging
        return null;
    }
}


async function restrict(req, res, next) {
    const userUid = req.cookies?.uid;
    if (!userUid) {
        console.log("No user token found, redirecting to login.");
        return res.redirect("/api/login");
    }
    const user = getUser(userUid);
    if (!user) {
        console.log("Invalid or expired token, redirecting to login.");
        return res.redirect("/api/login");
    }
    req.user = user;
    console.log("User verified:", user); // Debug: Confirm user data
    next();
}


async function restrictManager(req, res, next) {
    const userUid = req.cookies?.manageruid; // Manager token stored in the 'uid' cookie
    if (!userUid) {
        console.log("No token found, redirecting to manager login.");
        return res.redirect("/api/manager-login");
    }

    const user = getUser(userUid); // Decode the token
    if (!user) {
        console.log("Invalid or expired token, redirecting to manager login.");
        return res.redirect("/api/manager-login");
    }
    console.log("Decoded user:", user); // Inspect the decoded user object

    const { managerid } = user;  // Use the managerid from the decoded token

    // Search for the manager using managerid
    const manager = await Manager.findOne({ managerid });
    if (!manager) {
        console.log("Manager not found.");
        return res.redirect("/api/manager-login");
    }

    req.user = manager; // Attach manager info to request object for further use
    console.log("Manager verified:", manager); // Debug: Log manager details
    next();
}




app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));

app.get('/api/home', (req, res) => {
    res.render('home', {
        title: 'G124 Bank - Signature Verification System',
        mainTitle: 'G124 Bank',
        heroText: 'Welcome to our Signature Verification System project! Secure and authenticate your documents with confidence.',
        aboutText: 'Our Signature Verification System is designed to provide a secure and efficient solution for verifying the authenticity of signatures. Utilizing advanced AI and machine learning algorithms, the system detects fraudulent signatures, ensuring the integrity of important documents and transactions. The solution is perfect for financial institutions, government organizations, and businesses that demand top-notch security in their workflows.',
        features: [
            'Accurate Signature Verification using AI/ML',
            'Fraud Detection for Secure Transactions',
            'Real-time Signature Authentication',
            'Robust and User-Friendly Interface'
        ]
    });
});

// Manager login route
app.get("/api/manager-login", (req, res) => {
    res.render('manager');  // Renders the manager login page (manager-login.ejs)
});

// Handle the manager login POST request
app.post('/api/manager-login', async (req, res) => {
    const { managerid, password } = req.body;
    try {
        // Assume manager data validation is similar to user data
        const manager = await Manager.findOne({ managerid, password});  // Adjust the field names accordingly
        if (manager) {
            const token = setManager(manager);  // Create token for manager login
            res.cookie('manageruid', token, { httpOnly: true, maxAge: 3600000 });
            return res.redirect("/api/login");
        } else {
            return res.json({ success: false, message: "Invalid Manager ID or Password" });
        }
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


app.post('/api/managerlogout', (req, res) => {
    // Clear the JWT token cookie
    res.clearCookie('uid', {
        httpOnly: true, // Ensure secure handling
        secure: true,   // Use only with HTTPS
        sameSite: 'Strict' // Prevent CSRF
    });

    res.redirect('/api/home');
});

app.get('/api/manager-signup', (req, res) => {
    res.render('managerSignup'); // Ensure manager-signup.ejs exists in your views folder
});


app.post('/api/manager-signup', async (req, res) => {
    const { firstName, lastName, managerid, password } = req.body;

    try {
        // Check if the manager already exists
        const existingManager = await User.findOne({ managerid: managerid }); // Assuming managerid maps to email field
        if (existingManager) {
            return res.json({ success: false, message: "Manager ID already exists" });
        }

        // Create the manager in the database
        await Manager.create({
            firstName: firstName,
            lastName: lastName,
            managerid: managerid,
            password: password
        });

        return res.json({ success: true, message: "Manager signed up successfully!" });
    } catch (error) {
        console.error("Error during manager signup:", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
});




app.get("/api/signup", (req, res) => {
    return res.render("check");
});

app.post('/api/signup', upload.single('signature'), async (req, res) => {
    const { fName, lName, Acc_num } = req.body;

    if (!fName || !lName || !Acc_num || !req.file) {
        return res.status(400).json({ message: "All fields are required, including the signature file." });
    }

    const { buffer, mimetype } = req.file;
    console.log("Signup Data:", { fName, lName, Acc_num });

    try {
        const existingUser = await User.findOne({ Acc_num });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Account number already exists." });
        }

        const imageData = {
            data: buffer.toString('base64'), // Convert buffer to base64 string
            contentType: mimetype,
        };

        await User.create({ fName, lName, Acc_num, real_image: imageData });
        return res.json({ success: true});
    } catch (error) {
        console.error("Signup Error:", error.message);
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});



app.get('/api/login', restrictManager, async (req, res) => {
    const user = req.user
    res.render('check',{username:` ${user.firstName} ${user.lastName}`});
});

app.post('/api/login', async (req, res) => {
    const { Acc_num } = req.body;
   
    try {
        const user = await User.findOne({ Acc_num });
        // console.log(user)
        if (user) {
            const token=setUser(user);
            res.cookie('uid', token, { httpOnly: true, maxAge: 3600000 });

            return res.json({ success: true, message: "Login successful" });
        } else {
            return res.json({ success: false, message: "Invalid username or password" });
        }
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
  

app.get("/api/dashboard",restrict, (req, res) => {
    let username= req.user.fName+ req.user.lName
    res.render('dashboard', { username: username });
});
// app.post('/api/dashboard', restrict, upload.single('image'), async (req, res) => {
//     try {
//         if (!req.file) {
//             return res.status(400).json({ message: "File upload failed" });
//         }
        
//         const { path, filename } = req.file;
//         const image = req.file;
//         const userId = req.user.id;

//         const formData = new FormData();
//         formData.append('image', image.buffer, image.originalname);

//          // Make the request to Flask API
//         const response = await axios.post('http://127.0.0.1:5000/predict', formData, {
//         headers: {
//           'Content-Type': 'multipart/form-data'
//         }
//         });

//             // Get the prediction from Flask
//         const prediction = response.data.prediction;


//         const updateResult = await User.findByIdAndUpdate(
//             userId,
//             { $push: { path: path, filename: filename } },
//             { new: true } 
//         );
//         if (!updateResult) {
//             return res.status(400).json({ message: "User not found" });
//         }
//         console.log("File uploaded and saved:", req.file);

//         return res.json({
//             success: true,
//             filename: filename,
//             prediction: prediction // send prediction data to frontend
//         });
//     } catch (error) {
//         console.error("Error updating user with file data:", error.message);
//         res.status(500).json({ message: "Internal Server Error" });
//     }
// });

app.post('/api/dashboard', restrict, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "File upload failed" });
        }

        // Read file and convert to Base64
        const { buffer, mimetype } = req.file;
        const base64Image = buffer.toString('base64');

        // Prepare image data for database
        const imageData = {
            data: base64Image,
            contentType: mimetype,
        };

        const userId = req.user.id;
        const user = await User.findById(req.user.id); // Ensure we fetch the complete user record
        if (!user || !user.real_image) {
            return res.status(400).json({ message: "User real_image not found" });
        }
        // Update user's images array
        const updateResult = await User.findByIdAndUpdate(
            userId,
            { $push: { images: imageData } },
            { new: true }
        );

        if (!updateResult) {
            return res.status(400).json({ message: "User not found" });
        }

      

        // Perform signature verification (dummy example)
        // console.log("hi "+req.user.real_image.data);

        // Prepare data for Flask
        const dataToSend = {
            uploaded_image: base64Image, // Add the uploaded image Base64
            real_image: user.real_image.data,
            Acc_num: user.Acc_num, // Add the real_image Base64 (from MongoDB)
        };

        // Send the images as JSON to Flask for verification
        const flaskResponse = await fetch('http://localhost:5000/api/verify_signature', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataToSend), // Send as JSON instead of FormData
        });
        console.log("Data sent")

        const flaskResult = await flaskResponse.json();
        
        // Example: Assuming Flask returns a result with a prediction
        const result = flaskResult.prediction || 'Verification Failed';
        console.log(result)

        const timestamp = new Date();

        // Save the result along with the timestamp in the prediction array
        await User.findByIdAndUpdate(req.user.id, {
            $push: { prediction: { result, timestamp } },
        });

        return res.json({
            // success: true,
            filename: req.file.originalname,
            prediction: result,
            base64Image: base64Image, // Include the verification result
        });
    } catch (error) {
        console.error("Error processing upload:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
});




// app.get("/api/forgotPassword", (req,res)=>{
//     res.render('check')
// });
// app.post("/api/forgotPassword", async (req,res) => {
//     const { email, new_password } = req.body;
//     try {
//         const user = await User.findOne({ email});
//         if (user) {
//             const result = await User.updateOne(
//                 { email: email },
//                 { $set: { password: new_password } }
//               );
//               if (result.modifiedCount > 0) {
//             return res.json({ success: true });
//               }
//         } else {
//             return res.json({ success: false, message: "Invalid username or password" });
//         }
//     } catch (error) {
//         res.status(500).json({ message: 'Internal Server Error' });
//     }
// });


app.post('/api/logout', (req, res) => {
    // Clear the JWT token cookie
    res.clearCookie('uid', {
        httpOnly: true, // Ensure secure handling
        secure: true,   // Use only with HTTPS
        sameSite: 'Strict' // Prevent CSRF
    });

    res.redirect('/api/login');
});


// app.get('/api/profile', restrict, async (req, res) => {
//     try {
//         const user = await User.findById(req.user.id);
//         if (!user) {
//             return res.status(404).send('User not found');
//         }
//         res.render('profile', {
//             username: user.fname + " " + user.lname,
//             email:user.email,
//             images: user.path
//         });
//     } catch (error) {
//         console.error("Error fetching user profile:", error.message);
//         res.status(500).send("Internal Server Error");
//     }
// });
app.get('/api/profile', restrict, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).send('User not found');
        }

        const images = (user.images || []).map((img, index) => ({
            src: `data:${img.contentType};base64,${img.data}`,
            prediction: user.prediction && user.prediction[index]
                ? {
                    result: user.prediction[index].result,
                    timestamp: user.prediction[index].timestamp
                  }
                : null,
        }));
        

        images.forEach((img, index) => {
            console.log(`Image ${index} SRC: ${img.src.substring(0, 100)}...`); // Preview the first 100 characters
            console.log(`Image ${index} Prediction: ${img.prediction}`);  // Log the prediction info
        });
        

        res.render('profile', {
            username:` ${user.fName} ${user.lName}`,
            email: user.Acc_num,
            images: images, // Render images from the images array

        });
    } catch (error) {
            console.error("Error fetching user profile:", error.message);
            res.status(500).send("Internal Server Error");
    }
});




app.get("/api/check",(req,res)=>{
    res.render('check1',{username:req.user.username});
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});