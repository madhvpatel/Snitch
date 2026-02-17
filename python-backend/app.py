from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import tempfile
import demucs.api
import torch
import shutil
from pathlib import Path

# Initialize Flask
app = Flask(__name__)
# Allow CORS for the frontend
CORS(app, origins=['http://localhost:5173'])

# Configure Storage
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
OUTPUT_FOLDER = os.path.join(os.getcwd(), 'separated')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# ---------------------------------------------------------
# AI Model Loader (Global)
# ---------------------------------------------------------
print("⏳ Loading Demucs AI Model (htdemucs)... this may take a moment.")

# Detect GPU availability for Apple Silicon
import torch
device = "cpu"  # Default to CPU
if torch.backends.mps.is_available() and torch.backends.mps.is_built():
    device = "mps"
    print("✅ Apple GPU (MPS) detected and will be used for acceleration!")
else:
    print("⚠️  GPU not available, falling back to CPU (slower)")

try:
    # Use 'htdemucs' (Hybrid Transformer) with MPS device
    separator = demucs.api.Separator(model="htdemucs", device=device)
    print(f"✅ Demucs Model Loaded Successfully on device: {device.upper()}!")
except Exception as e:
    print(f"❌ Failed to load Demucs model: {e}")
    separator = None

# ---------------------------------------------------------
# Routes
# ---------------------------------------------------------

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'service': 'Snitch Local AI Engine',
        'model_loaded': separator is not None
    })

@app.route('/api/isolate', methods=['POST'])
def isolate_audio():
    """
    Separates Vocals from Music using Demucs.
    Expects 'audio' file in multipart/form-data.
    """
    if not separator:
        return jsonify({'error': 'AI Model not loaded on server.'}), 503

    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400

    audio_file = request.files['audio']
    if audio_file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    # 1. Save Uploaded File
    temp_dir = tempfile.mkdtemp()
    input_path = os.path.join(temp_dir, 'input_source.webm')
    audio_file.save(input_path)
    
    print(f"🎵 Processing isolation request: {audio_file.filename}", flush=True)
    print(f"📁 Saved to: {input_path}", flush=True)
    print(f"📦 File size: {os.path.getsize(input_path) / (1024*1024):.2f} MB", flush=True)

    try:
        # 2. Run Separation
        print("🔬 Starting Demucs separation (this may take 1-3 minutes on CPU)...", flush=True)
        print("⏳ Model: htdemucs | Device: CPU | Stems: vocals, drums, bass, other", flush=True)
        
        import time
        start_time = time.time()
        
        origin, separated = separator.separate_audio_file(input_path)
        
        elapsed = time.time() - start_time
        print(f"✅ Separation completed in {elapsed:.1f} seconds", flush=True)
        
        # separated is a Dictionary: {'vocals': Tensor, 'drums': Tensor, ...}
        print(f"📊 Separated stems: {list(separated.keys())}", flush=True)
        
        # Create a unique ID for this separation job
        job_id = os.urandom(4).hex()
        job_folder = os.path.join(OUTPUT_FOLDER, job_id)
        os.makedirs(job_folder, exist_ok=True)
        
        results = {}
        
        # 3. Save Stems using soundfile (avoids torchcodec dependency)
        import soundfile as sf
        
        print(f"💾 Saving stems to: {job_folder}", flush=True)
        
        # Iterate over stems (vocals, drums, bass, other)
        for stem, tensor in separated.items():
             print(f"  Writing {stem}.wav...", flush=True)
             output_path = os.path.join(job_folder, f"{stem}.wav")
             
             # Convert tensor to numpy: (Channels, Time) -> (Time, Channels) for soundfile
             audio_np = tensor.cpu().numpy().T
             sf.write(output_path, audio_np, separator.samplerate)
             
             # Construct URL
             results[stem] = f"http://localhost:5001/separated/{job_id}/{stem}.wav"

        print(f"✅ Separation complete for Job {job_id}", flush=True)
        
        # Clean up input
        shutil.rmtree(temp_dir)
        
        # Return Links
        return jsonify({
            'status': 'success',
            'job_id': job_id,
            'stems': results
        })

    except Exception as e:
        print(f"❌ Separation Error: {e}", flush=True)
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# Serve Static Files
@app.route('/separated/<path:filename>')
def serve_separated(filename):
    return send_from_directory(OUTPUT_FOLDER, filename)

if __name__ == '__main__':
    # Run on Port 5000 to avoid conflict with Node (3001)
    print("🚀 Local AI Service starting on port 5000...")
    app.run(host='0.0.0.0', port=5001, debug=False)
