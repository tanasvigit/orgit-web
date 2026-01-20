import React from 'react';

interface LocationMessageProps {
  latitude?: number;
  longitude?: number;
  locationName?: string;
  isMyMessage: boolean;
}

export const LocationMessage: React.FC<LocationMessageProps> = ({ latitude, longitude, locationName, isMyMessage }) => {
  const mapUrl = latitude && longitude 
    ? `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`
    : null;

  return (
    <div className={`bg-primary p-1 rounded-2xl ${isMyMessage ? 'rounded-br-none' : 'rounded-bl-none'} overflow-hidden max-w-[280px]`}>
      <div className="relative w-full h-32 bg-gray-200 rounded-xl overflow-hidden mb-1 border border-white/10">
        {mapUrl ? (
          <iframe
            src={mapUrl}
            className="w-full h-full border-0"
            title="Location map"
          />
        ) : (
          <div className="w-full h-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-gray-400">location_on</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-primary/90 p-2 rounded-full shadow-lg border-2 border-white">
            <span className="material-symbols-outlined text-white text-xl">location_on</span>
          </div>
        </div>
      </div>
      <div className="px-3 py-2 text-white">
        <p className="text-sm font-semibold">{locationName || 'Location'}</p>
        <p className="text-xs opacity-90">Current location</p>
      </div>
    </div>
  );
};

