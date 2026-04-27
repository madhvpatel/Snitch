from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from pathlib import Path
import sys
import tempfile
import shutil
import numpy as np
from dotenv import load_dotenv

# Initialize Flask
load_dotenv()
app = Flask(__name__)
project_root = Path(__file__).resolve().parents[1]
default_demucs_gui_venv = project_root / 'Demucs-Gui' / 'venv'
configured_demucs_gui_venv = Path(os.getenv('DEMUCS_GUI_VENV', default_demucs_gui_venv))
if not configured_demucs_gui_venv.is_absolute():
    configured_demucs_gui_venv = (Path(__file__).resolve().parent / configured_demucs_gui_venv).resolve()

demucs_gui_site_packages = None
for candidate in sorted((configured_demucs_gui_venv / 'lib').glob('python*/site-packages')):
    if candidate.is_dir():
        demucs_gui_site_packages = candidate
        if str(candidate) not in sys.path:
            sys.path.insert(0, str(candidate))
        break

demucs_runtime = 'python-backend-venv'
if demucs_gui_site_packages:
    demucs_runtime = 'demucs-gui-venv'

default_allowed_origins = [
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
]
allowed_origins = [origin.strip() for origin in os.getenv('ALLOWED_ORIGIN', ','.join(default_allowed_origins)).split(',') if origin.strip()]
app_port = int(os.getenv('PYTHON_AI_PORT', '5001'))
demucs_model = os.getenv('DEMUCS_MODEL', 'htdemucs')
demucs_device_preference = os.getenv('DEMUCS_DEVICE', 'auto').strip().lower()

# Allow CORS for the frontend
CORS(app, origins=allowed_origins)

# Configure Storage
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
OUTPUT_FOLDER = os.path.join(os.getcwd(), 'separated')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# ---------------------------------------------------------
# AI Model Loader (Global)
# ---------------------------------------------------------
print(f"⏳ Loading Demucs AI Model ({demucs_model})... this may take a moment.")

device = "unavailable"
dependency_error = None
separator = None
try:
    import demucs.api
    import torch

    # Allow explicit device pinning so reruns can stay stable across jobs.
    if demucs_device_preference in {"cpu", "mps"}:
        device = demucs_device_preference
        if device == "mps" and not (torch.backends.mps.is_available() and torch.backends.mps.is_built()):
            raise RuntimeError('DEMUCS_DEVICE=mps was requested, but MPS is not available')
        print(f"🎛️  Demucs device forced by DEMUCS_DEVICE={device}")
    else:
        device = "cpu"
        if torch.backends.mps.is_available() and torch.backends.mps.is_built():
            device = "mps"
            print("✅ Apple GPU (MPS) detected and will be used for acceleration!")
        else:
            print("⚠️  GPU not available, falling back to CPU (slower)")

    separator = demucs.api.Separator(model=demucs_model, device=device)
    print(f"✅ Demucs Model Loaded Successfully on device: {device.upper()}!")
except Exception as e:
    print(f"❌ Failed to load Demucs model: {e}")
    dependency_error = str(e)

# ---------------------------------------------------------
# Routes
# ---------------------------------------------------------

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'service': 'Snitch Local AI Engine',
        'model_loaded': separator is not None,
        'model': demucs_model,
        'device': device,
        'device_preference': demucs_device_preference,
        'demucs_runtime': demucs_runtime,
        'demucs_gui_venv': str(configured_demucs_gui_venv),
        'demucs_site_packages': str(demucs_gui_site_packages) if demucs_gui_site_packages else None,
        'dependency_error': dependency_error,
        'allowed_origin': allowed_origins,
        'output_dir': OUTPUT_FOLDER
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
    _, input_extension = os.path.splitext(audio_file.filename)
    input_extension = input_extension or '.webm'
    input_path = os.path.join(temp_dir, f'input_source{input_extension}')
    audio_file.save(input_path)
    
    print(f"🎵 Processing isolation request: {audio_file.filename}", flush=True)
    print(f"📁 Saved to: {input_path}", flush=True)
    print(f"📦 File size: {os.path.getsize(input_path) / (1024*1024):.2f} MB", flush=True)

    try:
        # 2. Run Separation
        print("🔬 Starting Demucs separation (runtime depends on the active device and clip length)...", flush=True)
        print(f"⏳ Model: {demucs_model} | Device: {device.upper()} | Stems: vocals, drums, bass, other", flush=True)
        
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
             results[stem] = f"{request.host_url.rstrip('/')}/separated/{job_id}/{stem}.wav"

        music_components = [
            separated.get('drums'),
            separated.get('bass'),
            separated.get('other'),
        ]
        available_music_components = [tensor for tensor in music_components if tensor is not None]
        if available_music_components:
            print("  Writing music.wav...", flush=True)
            music_tensor = available_music_components[0].clone()
            for tensor in available_music_components[1:]:
                music_tensor = music_tensor + tensor

            music_path = os.path.join(job_folder, 'music.wav')
            music_np = music_tensor.cpu().numpy().T
            music_np = np.clip(music_np, -1.0, 1.0)
            sf.write(music_path, music_np, separator.samplerate)
            results['music'] = f"{request.host_url.rstrip('/')}/separated/{job_id}/music.wav"

        print(f"✅ Separation complete for Job {job_id}", flush=True)
        
        # Return Links
        return jsonify({
            'status': 'success',
            'job_id': job_id,
            'model': demucs_model,
            'device': device,
            'stems': results
        })

    except Exception as e:
        print(f"❌ Separation Error: {e}", flush=True)
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

# Serve Static Files
@app.route('/separated/<path:filename>')
def serve_separated(filename):
    return send_from_directory(OUTPUT_FOLDER, filename)

if __name__ == '__main__':
    print(f"🚀 Local AI Service starting on port {app_port}...")
    app.run(host='0.0.0.0', port=app_port, debug=False)
