import os
import subprocess
import sys

def main():
    print("Installing PyInstaller...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

    print("Building executable...")
    # Need to include the static dist folder
    # In PyInstaller, --add-data "source;destination" on Windows, "source:destination" on Linux/macOS
    separator = ";" if os.name == 'nt' else ":"
    
    # Assuming 'dist' frontend folder exists one level up
    app_dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist"))
    if not os.path.exists(app_dist_path):
        print(f"ERROR: Cannot find dist folder at {app_dist_path}")
        print("Please build the frontend first by running:")
        print("npm install && npm run build")
        print("in the root folder of the project.")
        sys.exit(1)
        
    config_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "config.json"))
    metdet_weights_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "MetDetPy", "weights"))
    
    args = [
        "pyinstaller",
        "--name", "TAPO_Meteor_Network",
        "--onedir", # single directory is better for including external configs they can edit
        # "--windowed", # Removed so user can see console output and close it easily # Don't open a terminal (or remove this if you WANT a console)
        f"--add-data={app_dist_path}{separator}dist", 
        f"--add-data={config_path}{separator}.", 
        f"--add-data={metdet_weights_path}{separator}MetDetPy/weights", 
        "app.py"
    ]
    
    if os.name == 'nt':
        # Provide a default icon if you have one, or just ignore for now
        pass
        
    subprocess.check_call(args)
    print("\n\nBuild Complete!")
    print("You can find the standalone app in the 'dist/TAPO_Meteor_Network' folder.")
    print("You can zip this folder to share it with your friends.")
    print("Alternatively, you can package this 'dist/TAPO_Meteor_Network' folder using Inno Setup to create a standard Windows installer (.exe).")

if __name__ == "__main__":
    main()
