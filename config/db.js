// db.js
import { connect } from 'mongoose';

const connectDB = async () => {
  try {
    const dbURI = process.env.MONGODB_URI;
    await connect(dbURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
};

export default connectDB;
