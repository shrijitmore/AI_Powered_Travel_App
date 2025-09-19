import firebase_admin
from firebase_admin import credentials, auth
import json
import os

# Firebase service account key (stored as environment variable in production)
firebase_config = {
    "type": "service_account",
    "project_id": "aitravel-b0b11",
    "private_key_id": "dummy",
    "private_key": "-----BEGIN PRIVATE KEY-----\nDUMMY_KEY\n-----END PRIVATE KEY-----\n",
    "client_email": "firebase-adminsdk-dummy@aitravel-b0b11.iam.gserviceaccount.com",
    "client_id": "dummy",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs"
}

def initialize_firebase():
    """Initialize Firebase Admin SDK with demo mode (no authentication required)"""
    try:
        # Initialize Firebase in demo mode for development
        if not firebase_admin._apps:
            # Use demo credentials for development
            os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'demo'
            firebase_admin.initialize_app()
        
        print("Firebase Admin SDK initialized successfully")
        return True
    except Exception as e:
        print(f"Error initializing Firebase: {e}")
        print("Using development mode without Firebase authentication")
        return False

def create_admin_user():
    """Create admin user"""
    try:
        admin_email = "admin@travelquest.com"
        admin_password = "admin123"
        
        # Try to create admin user
        user = auth.create_user(
            email=admin_email,
            password=admin_password,
            display_name="Travel Quest Admin"
        )
        
        # Set custom claims for admin role
        auth.set_custom_user_claims(user.uid, {'admin': True, 'role': 'admin'})
        
        print(f"Admin user created successfully: {admin_email}")
        print(f"Admin UID: {user.uid}")
        return user.uid
        
    except auth.EmailAlreadyExistsError:
        print("Admin user already exists")
        # Get existing user and set admin claims
        user = auth.get_user_by_email(admin_email)
        auth.set_custom_user_claims(user.uid, {'admin': True, 'role': 'admin'})
        return user.uid
    except Exception as e:
        print(f"Error creating admin user: {e}")
        return None

if __name__ == "__main__":
    print("Setting up Firebase Admin...")
    
    if initialize_firebase():
        admin_uid = create_admin_user()
        if admin_uid:
            print("✅ Firebase setup completed successfully!")
            print(f"Admin credentials: admin@travelquest.com / admin123")
        else:
            print("❌ Failed to create admin user")
    else:
        print("⚠️  Running in development mode without Firebase authentication")
        print("Admin credentials for local development: admin@travelquest.com / admin123")