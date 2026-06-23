# PerioVoice AI™ - Web Frontend

## 📱 React.js Web Application

Complete frontend for the PerioVoice AI dental assessment system.

### 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### 📂 Project Structure

```
web/
├── src/
│   ├── pages/
│   │   ├── Home.jsx          # Landing page
│   │   ├── Chat.jsx          # Assessment conversation
│   │   ├── Result.jsx        # Final results
│   │   └── History.jsx       # Past assessments
│   ├── components/
│   │   ├── VoiceButton.jsx   # Voice input
│   │   ├── ImageUpload.jsx   # Image picker
│   │   ├── ChatBubble.jsx    # Message display
│   │   ├── UrgencyBadge.jsx  # Urgency indicator
│   │   └── RiskGauge.jsx     # Risk visualization
│   ├── hooks/
│   │   └── useVoiceRecognition.js  # Web Speech API
│   ├── utils/
│   │   └── api.js            # Backend communication
│   ├── App.jsx               # Router setup
│   ├── main.jsx              # Entry point
│   └── index.css             # Global styles
├── index.html                # HTML template
├── package.json              # Dependencies
├── vite.config.js            # Vite config
├── tailwind.config.js        # Tailwind config
└── postcss.config.js         # PostCSS config
```

### 🎨 Features

✅ **Three Input Methods**
- 🎤 Voice input using Web Speech API
- 💬 Text chat interface
- 📸 Image upload and analysis

✅ **Interactive Components**
- Real-time message chat
- Voice transcription display
- Image preview with validation
- Animated urgency badges
- Risk gauge visualization

✅ **Responsive Design**
- Mobile-first approach
- Tailwind CSS styling
- Smooth animations
- Dark/light mode ready

✅ **Backend Integration**
- Axios API client
- Session management
- Error handling
- Async operations

### 🔊 Voice Input

The app uses the Web Speech API for voice recognition:
- Records user's voice
- Transcribes to text
- Displays transcript in real-time
- Works in modern browsers (Chrome, Edge, Safari)

### 📸 Image Upload

Supported features:
- JPG and PNG formats
- Max 5MB file size
- Image preview
- Automatic analysis
- Error handling

### 🎯 Component Guide

**VoiceButton**
```jsx
<VoiceButton 
  onTranscriptReady={(text) => handleText(text)}
  onError={(err) => handleError(err)}
/>
```

**ImageUpload**
```jsx
<ImageUpload 
  onImageSelected={(file) => handleImage(file)}
  onError={(err) => handleError(err)}
/>
```

**UrgencyBadge**
```jsx
<UrgencyBadge 
  level="MODERATE"
  riskScore={6}
/>
```

**RiskGauge**
```jsx
<RiskGauge 
  score={6}
  size="md"  // sm, md, lg
/>
```

### 🌐 API Endpoints

The app connects to these backend endpoints:

- `POST /api/start` - Start assessment
- `POST /api/chat` - Send message
- `POST /api/image` - Upload image
- `GET /api/history` - Get past assessments

### ⚙️ Configuration

Set backend URL in environment:
```
VITE_BACKEND_URL=http://localhost:8000
```

Or update in [src/utils/api.js](src/utils/api.js):
```javascript
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
```

### 🎨 Customization

**Colors** - Edit [tailwind.config.js](tailwind.config.js):
```javascript
colors: {
  teal: {
    500: '#00897B',  // Primary color
  }
}
```

**Fonts** - Set in HTML head or config:
```css
font-family: 'Poppins', 'Inter', sans-serif;
```

### 📦 Dependencies

- **React 18** - UI framework
- **React Router 6** - Navigation
- **Axios** - HTTP client
- **Tailwind CSS** - Styling
- **Vite** - Build tool

### 🚢 Deployment

**Vercel (Recommended)**
```bash
npm install -g vercel
vercel
```

**Netlify**
```bash
npm run build
# Drag build/ folder to Netlify
```

**Manual Build**
```bash
npm run build
# Deploy dist/ folder to any static host
```

### 🐛 Troubleshooting

**Voice input not working?**
- Check browser compatibility (Chrome, Edge, Safari)
- Allow microphone permissions
- Check browser console for errors

**Images not uploading?**
- Verify file size (max 5MB)
- Check file format (JPG, PNG only)
- Ensure backend is running

**Backend connection failed?**
- Check backend URL in api.js
- Verify backend is running on port 8000
- Check CORS settings

### 📝 License

PerioVoice AI™ - Final Year University Project

### 👨‍💻 Development

For hot reload development:
```bash
npm run dev
```

Port: http://localhost:3000

---

**Ready to deploy? See backend README for full setup instructions.**
