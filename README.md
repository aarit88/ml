# Driver Drowsiness Detection System

A modern web-based driver drowsiness detection system with real-time monitoring, alerts, and beautiful animations using your specified color palette.

## Features

### 🎯 Core Functionality
- **Real-time Camera Monitoring**: Live video feed with face detection
- **Drowsiness Detection**: Monitors eye aspect ratio (EAR) and mouth aspect ratio (MAR)
- **Smart Alerts**: Visual and audio alerts when drowsiness is detected
- **Session Statistics**: Tracks drowsy events, yawns, and total alerts
- **Screenshot & Recording**: Capture evidence of drowsiness events

### 🎨 Design & Animation
- **Custom Color Palette**: Uses your specified colors (#E5D9B6, green shades)
- **Smooth Animations**: Fade-in, slide-up, pulse, and gradient animations
- **Responsive Design**: Works perfectly on desktop and mobile devices
- **Modern UI**: Clean, intuitive interface with Tailwind CSS
- **Interactive Elements**: Hover effects, transitions, and micro-interactions

### ⚙️ Settings & Configuration
- **Adjustable Thresholds**: Customize EAR and MAR detection sensitivity
- **Alert Preferences**: Enable/disable audio alerts
- **Real-time Metrics**: Live visualization of detection values

## Quick Start

### Prerequisites
- Modern web browser with camera support
- Local HTTP server (for camera permissions)

### Installation & Running

1. **Navigate to project directory:**
   ```bash
   cd c:\Users\Admin\OneDrive\Desktop\ML
   ```

2. **Start a local server:**
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx http-server -p 8000
   
   # Using PHP
   php -S localhost:8000
   ```

3. **Open in browser:**
   ```
   http://localhost:8000
   ```

### Alternative: VS Code Live Server
If you're using VS Code:
1. Install the "Live Server" extension
2. Right-click `index.html` and select "Open with Live Server"

## Usage Guide

### Starting the System
1. Click **"Start Camera"** to begin monitoring
2. Allow camera permissions when prompted
3. The system will automatically start detecting drowsiness

### Understanding the Interface

#### Status Indicators
- **🟢 Green**: Driver is attentive
- **🟡 Orange**: Driver is yawning
- **🔴 Red**: Drowsiness detected

#### Metrics
- **Eye Ratio (EAR)**: Measures eye openness (0.24 threshold)
- **Mouth Ratio (MAR)**: Measures mouth opening (0.55 threshold)

#### Alerts
- Visual alerts appear in the alerts panel
- Modal popups for critical alerts
- Optional audio alerts (configurable in settings)

### Settings Configuration
Access settings via the gear icon (⚙️) in the header:
- Adjust detection thresholds
- Enable/disable alert sounds
- Fine-tune sensitivity

## Technical Architecture

### Frontend Stack
- **HTML5**: Semantic structure
- **CSS3**: Custom animations with your color palette
- **JavaScript ES6+**: Modern features and async/await
- **Tailwind CSS**: Utility-first styling
- **Font Awesome**: Icon library

### Key Components
- `DrowsinessDetector` class: Main application logic
- Real-time camera access via `getUserMedia()`
- Canvas-based detection visualization
- Event-driven architecture for alerts

### Color Palette Implementation
```css
:root {
    --beige-light: #E5D9B6;
    --green-light: #A8D5A8;
    --green-medium: #6BA644;
    --green-dark: #4A7C4A;
    --green-darker: #2F5233;
}
```

## File Structure
```
ML/
├── index.html          # Main application interface
├── styles.css          # Custom styles and animations
├── script.js           # Application logic
├── README.md           # This documentation
├── detect_drowsiness.py # Original Python script
└── [other ML files]
```

## Integration with Backend

### Current State
The frontend currently simulates detection values for demonstration. To integrate with your Python backend:

### Option 1: WebSocket Integration
```javascript
// Connect to Python backend
const ws = new WebSocket('ws://localhost:8765');
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    this.updateMetrics(data.ear, data.mar);
};
```

### Option 2: REST API Integration
```javascript
// Poll backend for detection data
async function fetchDetectionData() {
    const response = await fetch('/api/detection');
    const data = await response.json();
    this.updateMetrics(data.ear, data.mar);
}
```

### Option 3: Direct Python Integration
Use a web framework like Flask or FastAPI to serve your Python detection logic alongside the frontend.

## Deployment

### Cloud Deployment Options

#### 1. Static Hosting (Easiest)
- **Netlify**: Drag and drop deployment
- **Vercel**: Git-based deployment
- **GitHub Pages**: Free static hosting
- **Firebase Hosting**: Google's static hosting

#### 2. Full-Stack Deployment
- **Heroku**: Add Python backend
- **AWS Amplify**: Full-stack hosting
- **DigitalOcean**: Custom server setup
- **Azure App Service**: Microsoft's cloud platform

#### 3. Container Deployment
```dockerfile
# Dockerfile example
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
```

### Environment Configuration
For production, ensure:
- HTTPS is enabled (required for camera access)
- Proper CORS configuration
- Secure API endpoints
- Environment-specific settings

## Browser Compatibility

### Supported Browsers
- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 11+
- ✅ Edge 79+

### Required Features
- `getUserMedia()` API for camera access
- ES6+ JavaScript features
- CSS3 animations and transitions

## Troubleshooting

### Common Issues

#### Camera Not Working
1. Check browser permissions
2. Ensure HTTPS in production
3. Try different browser
4. Check if camera is used by another app

#### Alerts Not Showing
1. Check browser notification permissions
2. Ensure JavaScript is enabled
3. Check console for errors

#### Performance Issues
1. Close other camera-using applications
2. Reduce video resolution in settings
3. Check system resources

### Debug Mode
Open browser console (F12) to see:
- Detection values in real-time
- Error messages
- Performance metrics

## Future Enhancements

### Planned Features
- [ ] Machine learning model integration
- [ ] Driver behavior analytics
- [ ] Multi-driver support
- [ ] Cloud data synchronization
- [ ] Mobile app version
- [ ] Advanced reporting dashboard

### API Extensions
- [ ] RESTful API for third-party integration
- [ ] WebSocket for real-time data streaming
- [ ] Export functionality (CSV, PDF reports)

## Contributing

### Development Setup
1. Clone the repository
2. Start local server
3. Make changes
4. Test thoroughly
5. Submit pull requests

### Code Style
- Use ES6+ features
- Follow responsive design principles
- Maintain accessibility standards
- Comment complex logic

## License

This project is open source and available under the MIT License.

## Support

For questions or issues:
1. Check this README
2. Review browser console
3. Test in different browsers
4. Contact development team

---

**Note**: This frontend is designed to work with your existing Python drowsiness detection system. The current implementation simulates detection values for demonstration purposes. Integration with your actual computer vision backend can be done via WebSocket, REST API, or server-side rendering.
