import mongoose from "mongoose"
import bcrypt from 'bcrypt';
import { ItemSchema } from "./Item.js";

const {Schema, model} = mongoose;

const UserSchema = Schema({
    name: {type: String, required: true},
    email: {type: String, required: true},
    phone: {type: String, required: true},
    password: {type: String, required: true},
    professionType: {type: Number, required: true},
    profession: {type: Number, required: true},
    useCases: {type: Array, required: true},
    dateOfStart: {type: Array, required: true},
    checkingAccounts: [ItemSchema],
    creditCards: [ItemSchema],
    onBoardingComplete: {type: Boolean, default: false}
});


// Define a static method to find a user by email
UserSchema.statics.findByEmail = function (email) {
    return this.findOne({ email });
  };
  
  // Define a static method to find a user by phone
UserSchema.statics.findByPhone = function (phone) {
    return this.findOne({ phone });
};


// Define a method to compare entered email with the actual email
UserSchema.methods.compareEmail = function (enteredEmail) {
    return this.email === enteredEmail;
  };

// Define a method to compare entered password with the actual password
UserSchema.methods.comparePassword = async function (enteredPassword) {
    try {
      return await bcrypt.compare(enteredPassword, this.password);
    } catch (error) {
      throw error;
    }
  };
  
  // Before saving a user, hash the password
  UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
      return next();
    }
  
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
      next();
    } catch (error) {
      return next(error);
    }
  });
  

UserSchema.methods.getCheckingAccounts = function () {
  return this.checkingAccounts;
}
UserSchema.methods.getCreditCards = function () {
  return this.creditCards;
}

const User = model('User', UserSchema);
export default User;