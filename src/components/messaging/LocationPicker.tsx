import React, { useState, useEffect } from 'react';

interface LocationPickerProps {
  onLocationSelect: (location: { lat: number; lng: number; address?: string }) => void;
  onClose: () => void;
  visible: boolean;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({ onLocationSelect, onClose, visible }) => {
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (visible) {
      getCurrentLocation();
    }
  }, [visible]);

  const getCurrentLocation = () => {
    setLoading(true);
    setError('');

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCurrentLocation({ lat, lng });

        // Try to get address from coordinates
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          const data = await response.json();
          if (data.display_name) {
            setAddress(data.display_name);
          }
        } catch (err) {
          console.error('Error fetching address:', err);
        }

        setLoading(false);
      },
      (err) => {
        setError('Could not get your location. Please check permissions.');
        setLoading(false);
      }
    );
  };

  const handleSend = () => {
    if (currentLocation) {
      onLocationSelect({
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        address: address || undefined,
      });
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-t-2xl w-full max-w-md shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Share Location</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-gray-500 dark:text-gray-400">Getting your location...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <span className="material-symbols-outlined text-4xl text-red-500">error</span>
            <p className="text-red-500 text-center">{error}</p>
            <button
              onClick={getCurrentLocation}
              className="bg-primary hover:bg-primary-dark text-white rounded-full px-6 py-3 font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : currentLocation ? (
          <div className="flex flex-col gap-4">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-2xl">location_on</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Location
                  </p>
                  {address && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{address}</p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={onClose}
                className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-full px-6 py-3 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                className="flex-1 bg-primary hover:bg-primary-dark text-white rounded-full px-6 py-3 font-medium transition-colors"
              >
                Send Location
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

