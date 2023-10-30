import express, { response } from "express";
// import { auth } from "express-oauth2-jwt-bearer";
import cors from "cors";
import bodyParser from "body-parser";
import plaidClient from "./plaidModule.js";
import connectDB from "./config/db.js";
import User from "./models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

connectDB();

const app = express();
app.use(bodyParser.json());
app.use(
  cors({
    origin: "*",
  })
);
// app.use(bodyParser.json());
// const checkJWT = auth({
//   audience: process.env.AUDIENCE,
//   issuerBaseURL: process.env.ISSUER_BASE_URL,
//   tokenSigningAlg: "RS256",
// });

app.get("/test", (req, res, next) => res.send("Server Running...."));

// app.get("/protected", (req, res, next) => {
//   res.json({
//     message: "Hello Authenticated user",
//   });
// });

app.get("/generate_public_link_token", async (req, res, next) => {
  try {
    const request = {
      user: {
        client_user_id: "user-id",
      },
      client_name: "My Taxfluence",
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
      redirect_uri: "http://localhost:5173/",
    };

    const plaidResponse = await plaidClient.linkTokenCreate(request);

    const publicLinkToken = plaidResponse.data.link_token;

    console.log(`Generated Link Token is--\n ${publicLinkToken}\n`);

    res.json({
      token: publicLinkToken,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Link Token fetch Failed",
    });
  }
});

app.patch("/update_onboarding_status", verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);

    user.set("onBoardingComplete", true);

    await user.save();

    console.log(user);

    res.status(200).json({ message: "OnBoardingStatus updated successfully" });
  } catch (err) {
    console.error(err);

    res.status(500).json({ message: "Onboarding Status update failed" });
  }
});

app.get('/onboardingStatus', verifyToken, async (req,res, next)=> {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);

    res.status(200).json({status: user.onBoardingComplete});


  } catch(err) {
    console.error(err);
    res.status(500).json({message: "User onboarding status fetch failed"});
  }
});

app.post("/exchange_access_token", verifyToken, async (req, res, next) => {
  try {
    console.log(`Body is ${req.body}`);
    const publicAccessToken = req.body.token;
    console.log(`\nPublic Access Token is --\n${publicAccessToken}\n`);
    const plaidResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicAccessToken,
    });

    const accessToken = plaidResponse.data.access_token;

    console.log(`\nAccess Token is --\n${accessToken}\n`);

    const plaidRequest = await plaidClient.accountsGet({
      access_token: accessToken,
    });
    const accounts = plaidRequest.data.accounts;

    const [account] = accounts;

    switch (req.body.type) {
      case "ADD_CHECKING_ACCOUNT": {
        if (account.subtype === "checking") {
          const userId = req.user.id;

          const user = await User.findById(userId);

          const checkingItem = {
            name: account.name,
            accountId: account.account_id,
            accessToken: accessToken,
            mask: account.mask
          };

          user.checkingAccounts.push(checkingItem);

          await user.save();

          res.status(200).json({
            accountName: account.name,
            accountMask: account.mask,
          });
        } else {
          res.status(400).json({
            message: "Please set a valid checking account",
          });
        }

        break;
      }

      case "ADD_CREDIT_CARD": {
        if (account.subtype === "credit card") {
          const userId = req.user.id;

          const user = await User.findById(userId);

          const checkingItem = {
            name: account.name,
            accountId: account.account_id,
            accessToken: accessToken,
            mask: account.mask,
          };

          user.creditCards.push(checkingItem);

          await user.save();

          res.status(200).json({
            accountName: account.name,
            accountMask: account.mask,
          });
        } else {
          res.status(400).json({
            message: "Please set a valid credit card",
          });
        }

        break;
      }

      default: {
        res.status(400).json({
          message: "Type not found",
        });
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Access Token fetch failed",
    });
  }
});

app.post("/fetch_accounts", verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);

    switch (req.body.type) {
      case "ADD_CHECKING_ACCOUNT": {
        const accounts = user.checkingAccounts.map((account) => ({
          name: account.name,
          mask: account.mask,
        }));
        res.status(200).json({accounts});
        break;
      }

      case "ADD_CREDIT_CARD": {
        const accounts = user.creditCards.map((account) => ({
          name: account.name,
          mask: account.mask,
        }));
        res.status(200).json({accounts});
        break;
      }

      default: {
        res.status(400).json({
          message: "Invalid Type",
        });
      }
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Fetching accounts failed...",
    });
  }
});

app.post("/register", async (req, res) => {
  try {
    // Get user input from the request body
    const {
      name,
      email,
      phone,
      password,
      professionType,
      profession,
      useCases,
      dateOfStart,
    } = req.body;

    // Check if the user with the given email or phone already exists
    const existingUserByEmail = await User.findByEmail(email);
    const existingUserByPhone = await User.findByPhone(phone);

    if (existingUserByEmail) {
      return res.status(400).json({
        type: 'USER_EMAIL_EXISTS',
        error: "User with this email already exists.",
      });
    }
    if (existingUserByPhone) {
      return res.status(400).json({
        type: 'USER_PHONE_EXISTS',
        error: "User with this phone number already exists.",
      });
    }

    // Create a new user
    const newUser = new User({
      name,
      email,
      phone,
      password, // Password will be hashed before saving (as per the schema)
      professionType,
      profession,
      useCases,
      dateOfStart,
    });

    // Save the new user to the database
    await newUser.save();

    const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, {
      expiresIn: "1h", // Token expires in 30 min (adjust as needed)
    });

    // Respond with a success message or user data (customize as needed)
    return res.status(201).json({
      message: "User registered successfully",
      userId: newUser.id,
      userToken: token,
    });
  } catch (error) {
    console.error("Error during registration:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log({ email, password });

  // Find the user by username (replace with a database query)
  const user = await User.findByEmail(email);
  console.log(user);

  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }

  // Compare the entered password with the hashed password
  bcrypt.compare(password, user.password, (err, result) => {
    if (err || !result) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Create a JWT token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h", // Token expires in 1 hour (adjust as needed)
    });

    res.json({ message: "Login successful", token, userId: user.id });
  });
});

function verifyToken(req, res, next) {
  const token = req.headers["authorization"].split("Bearer ")[1];

  if (!token) {
    return res.status(403).json({ message: "Token not provided" });
  }
  console.log(token);
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ message: "Token is invalid" });
    }

    req.user = user;
    next();
  });
}

app.get("/protected", verifyToken, (req, res) => {
  console.log(req.user);
});

const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`App started at port ${port}`));
