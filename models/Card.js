import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const CardSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    deadline: { type: Date, required: true },
    priority: { type: String, enum: ['Low', 'Medium', 'Urgent'], required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {timestamps: true });

const CardModel = model('creworktasks', CardSchema);

export default CardModel;
