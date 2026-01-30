import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const MemberOnboarding = ({ isOpen, onComplete, onClose, householdName, memberName }) => {
  const [step, setStep] = useState(1);
  const [onboardingData, setOnboardingData] = useState({
    // Room setup
    hasPrivateBedroom: true,
    
    // Pets & Vehicles they're responsible for
    hasPet: false,
    petTypes: [],
    hasVehicle: false,
    vehicleTypes: [],
    
    // Availability
    availability: {
      mondayToFriday: { start: '18:00', end: '22:00' },
      weekend: { start: '09:00', end: '21:00' }
    },
    
    // Preferences
    choreAversions: [],
    preferredTasks: [],
    maxDailyChoreLoad: 5
  });

  const handleInputChange = (field, value) => {
    setOnboardingData(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      onComplete(onboardingData);
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const choreCategories = [
    { id: 'dishes', label: '🍽️ Dishes', icon: '🍽️' },
    { id: 'laundry', label: '🧺 Laundry', icon: '🧺' },
    { id: 'bathroom', label: '🚿 Bathroom Cleaning', icon: '🚿' },
    { id: 'trash', label: '🗑️ Trash/Recycling', icon: '🗑️' },
    { id: 'vacuuming', label: '🧹 Vacuuming/Mopping', icon: '🧹' },
    { id: 'cooking', label: '🍳 Cooking', icon: '🍳' },
    { id: 'groceries', label: '🛒 Grocery Shopping', icon: '🛒' },
    { id: 'yard', label: '🌿 Yard Work', icon: '🌿' },
    { id: 'pets', label: '🐾 Pet Care', icon: '🐾' },
    { id: 'car', label: '🚗 Car Maintenance', icon: '🚗' }
  ];

  const renderProgressBar = () => {
    const progress = (step / 4) * 100;
    return (
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Step {step} of 4</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-green-500 to-teal-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  };

  // Step 1: Room & Responsibilities
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">🏠 Welcome to {householdName}!</h2>
        <p className="text-gray-600">Let's set up your profile, {memberName}</p>
      </div>

      <div>
        <Label className="text-lg font-semibold mb-3 block">Your Room Setup</Label>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant={onboardingData.hasPrivateBedroom ? 'default' : 'outline'}
            onClick={() => handleInputChange('hasPrivateBedroom', true)}
            className="h-20 flex flex-col"
          >
            <span className="text-3xl mb-1">🚪</span>
            <span>Private Bedroom</span>
          </Button>
          <Button
            variant={!onboardingData.hasPrivateBedroom ? 'default' : 'outline'}
            onClick={() => handleInputChange('hasPrivateBedroom', false)}
            className="h-20 flex flex-col"
          >
            <span className="text-3xl mb-1">🛏️</span>
            <span>Shared Bedroom</span>
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-lg font-semibold mb-3 block">Do you have any pets you care for?</Label>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Button
            variant={onboardingData.hasPet ? 'default' : 'outline'}
            onClick={() => handleInputChange('hasPet', true)}
            className="h-16"
          >
            🐾 Yes
          </Button>
          <Button
            variant={!onboardingData.hasPet ? 'default' : 'outline'}
            onClick={() => handleInputChange('hasPet', false)}
            className="h-16"
          >
            ❌ No
          </Button>
        </div>
        {onboardingData.hasPet && (
          <div className="grid grid-cols-3 gap-2">
            {['🐕 Dog', '🐈 Cat', '🐟 Fish', '🐦 Bird', '🐹 Small Pet'].map(pet => (
              <Button
                key={pet}
                variant={onboardingData.petTypes.includes(pet) ? 'default' : 'outline'}
                onClick={() => {
                  const types = onboardingData.petTypes.includes(pet)
                    ? onboardingData.petTypes.filter(p => p !== pet)
                    : [...onboardingData.petTypes, pet];
                  handleInputChange('petTypes', types);
                }}
                className="h-12 text-sm"
              >
                {pet}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label className="text-lg font-semibold mb-3 block">Do you have a vehicle?</Label>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Button
            variant={onboardingData.hasVehicle ? 'default' : 'outline'}
            onClick={() => handleInputChange('hasVehicle', true)}
            className="h-16"
          >
            🚗 Yes
          </Button>
          <Button
            variant={!onboardingData.hasVehicle ? 'default' : 'outline'}
            onClick={() => handleInputChange('hasVehicle', false)}
            className="h-16"
          >
            ❌ No
          </Button>
        </div>
        {onboardingData.hasVehicle && (
          <div className="grid grid-cols-3 gap-2">
            {['🚗 Car', '🏍️ Motorcycle', '🚲 Bicycle'].map(vehicle => (
              <Button
                key={vehicle}
                variant={onboardingData.vehicleTypes.includes(vehicle) ? 'default' : 'outline'}
                onClick={() => {
                  const types = onboardingData.vehicleTypes.includes(vehicle)
                    ? onboardingData.vehicleTypes.filter(v => v !== vehicle)
                    : [...onboardingData.vehicleTypes, vehicle];
                  handleInputChange('vehicleTypes', types);
                }}
                className="h-12 text-sm"
              >
                {vehicle}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Step 2: Availability
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">⏰ Your Availability</h2>
        <p className="text-gray-600">When are you typically available for chores?</p>
      </div>

      <div className="space-y-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <Label className="font-semibold mb-2 block">Weekdays (Mon-Fri)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={onboardingData.availability.mondayToFriday.start}
              onChange={(e) => setOnboardingData(prev => ({
                ...prev,
                availability: {
                  ...prev.availability,
                  mondayToFriday: { ...prev.availability.mondayToFriday, start: e.target.value }
                }
              }))}
              className="w-32"
            />
            <span>to</span>
            <Input
              type="time"
              value={onboardingData.availability.mondayToFriday.end}
              onChange={(e) => setOnboardingData(prev => ({
                ...prev,
                availability: {
                  ...prev.availability,
                  mondayToFriday: { ...prev.availability.mondayToFriday, end: e.target.value }
                }
              }))}
              className="w-32"
            />
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <Label className="font-semibold mb-2 block">Weekends (Sat-Sun)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={onboardingData.availability.weekend.start}
              onChange={(e) => setOnboardingData(prev => ({
                ...prev,
                availability: {
                  ...prev.availability,
                  weekend: { ...prev.availability.weekend, start: e.target.value }
                }
              }))}
              className="w-32"
            />
            <span>to</span>
            <Input
              type="time"
              value={onboardingData.availability.weekend.end}
              onChange={(e) => setOnboardingData(prev => ({
                ...prev,
                availability: {
                  ...prev.availability,
                  weekend: { ...prev.availability.weekend, end: e.target.value }
                }
              }))}
              className="w-32"
            />
          </div>
        </div>
      </div>

      <div>
        <Label className="text-lg font-semibold mb-3 block">Max Daily Chore Load</Label>
        <p className="text-sm text-gray-600 mb-3">How many chores can you handle per day?</p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="1"
            max="10"
            value={onboardingData.maxDailyChoreLoad}
            onChange={(e) => handleInputChange('maxDailyChoreLoad', parseInt(e.target.value))}
            className="flex-1"
          />
          <span className="text-2xl font-bold w-12 text-center">{onboardingData.maxDailyChoreLoad}</span>
        </div>
      </div>
    </div>
  );

  // Step 3: Chore Aversions
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">😬 Chore Aversions</h2>
        <p className="text-gray-600">Which chores do you really dislike? (We'll try to minimize these)</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {choreCategories.map(chore => (
          <Button
            key={chore.id}
            variant={onboardingData.choreAversions.includes(chore.id) ? 'destructive' : 'outline'}
            onClick={() => {
              const aversions = onboardingData.choreAversions.includes(chore.id)
                ? onboardingData.choreAversions.filter(c => c !== chore.id)
                : [...onboardingData.choreAversions, chore.id];
              handleInputChange('choreAversions', aversions);
            }}
            className="h-16 flex items-center gap-2"
          >
            <span className="text-xl">{chore.icon}</span>
            <span>{chore.label.split(' ').slice(1).join(' ')}</span>
          </Button>
        ))}
      </div>

      <p className="text-sm text-gray-500 text-center">
        Selected: {onboardingData.choreAversions.length} aversions
      </p>
    </div>
  );

  // Step 4: Preferred Tasks
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">💪 Preferred Tasks</h2>
        <p className="text-gray-600">Which chores do you actually enjoy or don't mind doing?</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {choreCategories.map(chore => (
          <Button
            key={chore.id}
            variant={onboardingData.preferredTasks.includes(chore.id) ? 'default' : 'outline'}
            onClick={() => {
              const preferred = onboardingData.preferredTasks.includes(chore.id)
                ? onboardingData.preferredTasks.filter(c => c !== chore.id)
                : [...onboardingData.preferredTasks, chore.id];
              handleInputChange('preferredTasks', preferred);
            }}
            className={`h-16 flex items-center gap-2 ${onboardingData.preferredTasks.includes(chore.id) ? 'bg-green-600 hover:bg-green-700' : ''}`}
          >
            <span className="text-xl">{chore.icon}</span>
            <span>{chore.label.split(' ').slice(1).join(' ')}</span>
          </Button>
        ))}
      </div>

      <div className="bg-purple-50 rounded-lg p-4 text-center">
        <p className="text-purple-800 font-medium">
          🎉 You're all set! Click "Join the Adventure" to start your quest!
        </p>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">🏰 Member Setup</DialogTitle>
        </DialogHeader>
        
        {renderProgressBar()}
        
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}

        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={step === 1}
          >
            ← Back
          </Button>
          <Button
            onClick={nextStep}
            className="bg-gradient-to-r from-green-500 to-teal-500 text-white"
          >
            {step === 4 ? '🚀 Join the Adventure!' : 'Next →'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MemberOnboarding;
