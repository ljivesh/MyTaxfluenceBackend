import mongoose from "mongoose";

export const ItemSchema = mongoose.Schema({
    name: String,
    accountId: String,
    accessToken: {type: String, required: true},
    mask: String
});



const Item = mongoose.model('Item', ItemSchema);
export default Item;