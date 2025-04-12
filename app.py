from flask import Flask, request, jsonify
import base64
import numpy as np
from PIL import Image
import io
import tensorflow as tf
import os

app = Flask(__name__)

# Custom layer for the model
@tf.keras.utils.register_keras_serializable(package="Custom", name="L1Distance")
class L1DistanceLayer(tf.keras.layers.Layer):
    def __init__(self, **kwargs):
        super(L1DistanceLayer, self).__init__(**kwargs)

    def call(self, inputs):
        return tf.math.abs(inputs[0] - inputs[1])

    def get_config(self):
        config = super(L1DistanceLayer, self).get_config()
        return config

# Path to the final saved model
MODEL_PATH = r'C:\Users\nishn\OneDrive\Desktop\project\siamese_model_for_flask.keras'  # Adjust the path if needed

try:
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")

    # Load the trained model with the custom L1DistanceLayer
    model = tf.keras.models.load_model(MODEL_PATH, custom_objects={"L1DistanceLayer": L1DistanceLayer})
    print("Model loaded successfully.")
except Exception as e:
    print(f"Error loading model: {str(e)}")
    model = None

@app.route('/api/verify_signature', methods=['POST'])
def verify_signature():
    try:
        # Parse JSON payload
        data = request.get_json()
        if not data or 'uploaded_image' not in data or 'real_image' not in data:
            return jsonify({"error": "Missing required fields 'uploaded_image' or 'real_image'"}), 400

        # Decode Base64 images
        try:
            uploaded_image_data = base64.b64decode(data['uploaded_image'])
            real_image_data = base64.b64decode(data['real_image'])
        except Exception as e:
            return jsonify({'error': f"Base64 decoding failed: {str(e)}"}), 400

        # Preprocess images
        uploaded_image = Image.open(io.BytesIO(uploaded_image_data)).resize((224, 224)).convert('RGB')
        real_image = Image.open(io.BytesIO(real_image_data)).resize((224, 224)).convert('RGB')

        # Normalize images
        uploaded_image = np.array(uploaded_image) / 255.0
        real_image = np.array(real_image) / 255.0

        # Expand dimensions for model input
        uploaded_image = np.expand_dims(uploaded_image, axis=0)
        real_image = np.expand_dims(real_image, axis=0)

        # Verify model is loaded
        if model is None:
            return jsonify({'error': 'Model not loaded successfully'}), 500

        # Make prediction
        prediction = model.predict([uploaded_image, real_image])
        similarity_score = float(prediction[0][0])  # Convert to float for JSON serialization
        print(similarity_score)

        # Determine result based on threshold
        threshold = 0.6  # Adjust based on your model's training
        result = 'Genuine' if similarity_score > threshold else 'Forged'
        

        return jsonify({
            "prediction": result,
            "score": similarity_score
        })
    except Exception as e:
        print(f"Error during signature verification: {str(e)}")
        return jsonify({'error': f"An unexpected error occurred: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True)
