import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

const EnhancedOnboarding = ({ isOpen, onComplete, onClose }) => {
  const [step, setStep] = useState(1);
  const [onboardingData, setOnboardingData] = useState({
    // Personal Info
    playerName: '',
    
    // Household Setup
    hasPets: false,
    petTypes: [],
    hasVehicle: false,
    vehicleSharing: 'shared', // 'shared', 'separate', 'none'
    livingSituation: '', // 'apartment', 'house', 'other'
    householdSize: 2,
    
    // Special Needs
    hasChildren: false,
    hasElderly: false,
    hasSpecialNeeds: false,
    specialNeedsDetails: '',
    
    // Chore Preferences
    selectedChoreCategories: [],
    customChores: [],
    
    // Game Preferences
    difficultyPreference: 'balanced', // 'easy', 'balanced', 'challenging'
    notificationPreferences: {
      daily: true,
      verification: true,
      encouragement: true
    }
  });

  const totalSteps = 6;

  const handleInputChange = (field, value) => {
    setOnboardingData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayToggle = (field, item) => {
    setOnboardingData(prev => ({
      ...prev,
      [field]: prev[field].includes(item) 
        ? prev[field].filter(x => x !== item)
        : [...prev[field], item]
    }));
  };

  const nextStep = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      onComplete(onboardingData);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const renderProgressBar = () => (
    <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
      <div 
        className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300"
        style={{ width: `${(step / totalSteps) * 100}%` }}
      />
    </div>
  );

  const generateKingdomSuggestions = () => [
    "Casa Chronicles", "Home Heroes", "Domestic Dynasty", "Chore Champions Kingdom",
    "The Tidy Realm", "Household Haven", "Task Masters Domain", "Adventure Estate",
    "The Clean Castle", "Harmony House", "Quest Villa", "Partnership Palace"
  ];

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">👑 Name Your Kingdom!</h2>
        <p className="text-gray-600">What shall we call your household adventure?</p>
      </div>
      
      <div>
        <Label htmlFor="kingdomName">🏰 Kingdom Name</Label>
        <Input
          id="kingdomName"
          value={onboardingData.kingdomName || ''}
          onChange={(e) => handleInputChange('kingdomName', e.target.value)}
          placeholder="Enter your household kingdom name"
          className="text-lg"
        />
        
        <div className="mt-3">
          <Label className="text-sm text-gray-600">💡 Need inspiration? Try these:</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {generateKingdomSuggestions().slice(0, 4).map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleInputChange('kingdomName', suggestion)}
                className="text-xs"
              >
                {suggestion}
              </Button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Pro tip: Try "[Last Name] + [Street Name]" or "[Both Names] Castle"
          </p>
        </div>
      </div>
      
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-bold mb-2">🎮 What You'll Create:</h3>
        <ul className="text-sm space-y-1">
          <li>• Customize chores for your living situation</li>
          <li>• Set up fair task distribution between 2 partners</li>
          <li>• Create invitation for your partner</li>
          <li>• Launch your gamified relationship journey!</li>
        </ul>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">🏠 Your Living Situation</h2>
        <p className="text-gray-600">Help us customize the perfect chore list for you</p>
      </div>
      
      <div>
        <Label className="text-lg font-semibold">Where do you live?</Label>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {['apartment', 'house', 'other'].map(type => (
            <Button
              key={type}
              variant={onboardingData.livingSituation === type ? 'default' : 'outline'}
              onClick={() => handleInputChange('livingSituation', type)}
              className="h-20 flex flex-col"
            >
              <div className="text-2xl mb-1">
                {type === 'apartment' ? '🏢' : type === 'house' ? '🏡' : '🏘️'}
              </div>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="bg-green-50 p-4 rounded-lg text-center">
        <h3 className="text-lg font-bold text-green-800 mb-2">👫 Couples Adventure</h3>
        <p className="text-sm text-green-700">
          This game is designed for 2 partners working together to conquer household tasks and build stronger relationships!
        </p>
        <div className="mt-3 text-2xl">💕</div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">🐾 Do You Have Pets?</h2>
        <p className="text-gray-600">We'll add pet care tasks to your adventure</p>
      </div>
      
      <div className="flex justify-center space-x-4">
        <Button
          variant={onboardingData.hasPets ? 'outline' : 'default'}
          onClick={() => {
            handleInputChange('hasPets', false);
            handleInputChange('petTypes', []);
          }}
          className="h-24 w-32 flex flex-col"
        >
          <div className="text-3xl mb-2">🚫</div>
          No Pets
        </Button>
        <Button
          variant={onboardingData.hasPets ? 'default' : 'outline'}
          onClick={() => handleInputChange('hasPets', true)}
          className="h-24 w-32 flex flex-col"
        >
          <div className="text-3xl mb-2">🐾</div>
          Yes!
        </Button>
      </div>

      {onboardingData.hasPets && (
        <div>
          <Label className="text-lg font-semibold">What types of pets? (Select all that apply)</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {[
              { type: 'dogs', emoji: '🐕', label: 'Dogs' },
              { type: 'cats', emoji: '🐱', label: 'Cats' },
              { type: 'birds', emoji: '🐦', label: 'Birds' },
              { type: 'fish', emoji: '🐠', label: 'Fish' },
              { type: 'reptiles', emoji: '🦎', label: 'Reptiles' },
              { type: 'small_mammals', emoji: '🐹', label: 'Small Animals' },
              { type: 'farm', emoji: '🐓', label: 'Farm Animals' },
              { type: 'other', emoji: '🦄', label: 'Other' }
            ].map(pet => (
              <Button
                key={pet.type}
                variant={onboardingData.petTypes.includes(pet.type) ? 'default' : 'outline'}
                onClick={() => handleArrayToggle('petTypes', pet.type)}
                className="h-16 flex flex-col text-xs"
              >
                <div className="text-xl mb-1">{pet.emoji}</div>
                {pet.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">🚗 Vehicle Responsibilities</h2>
        <p className="text-gray-600">Car maintenance and transportation tasks</p>
      </div>
      
      <div>
        <Label className="text-lg font-semibold">Do you own or regularly use vehicles?</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <Button
            variant={onboardingData.vehicleSharing === 'none' ? 'default' : 'outline'}
            onClick={() => handleInputChange('vehicleSharing', 'none')}
            className="h-20 flex flex-col"
          >
            <div className="text-2xl mb-1">🚶‍♀️</div>
            No vehicles
          </Button>
          <Button
            variant={onboardingData.vehicleSharing === 'shared' ? 'default' : 'outline'}
            onClick={() => handleInputChange('vehicleSharing', 'shared')}
            className="h-20 flex flex-col"
          >
            <div className="text-2xl mb-1">🚗</div>
            Shared car(s)
          </Button>
          <Button
            variant={onboardingData.vehicleSharing === 'separate' ? 'default' : 'outline'}
            onClick={() => handleInputChange('vehicleSharing', 'separate')}
            className="h-20 flex flex-col"
          >
            <div className="text-2xl mb-1">🚙</div>
            Separate cars
          </Button>
        </div>
      </div>

      {onboardingData.vehicleSharing !== 'none' && (
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-bold mb-2">🔧 Vehicle tasks we'll add:</h3>
          <ul className="text-sm space-y-1">
            <li>• Gas fill-ups and maintenance</li>
            <li>• Car washing and cleaning</li>
            <li>• Oil changes and inspections</li>
            <li>• Repairs and upkeep</li>
          </ul>
        </div>
      )}
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">🔔 Communication Preferences</h2>
        <p className="text-gray-600">How would you like to stay connected?</p>
      </div>
      
      <div className="bg-yellow-50 p-4 rounded-lg text-center">
        <h3 className="font-bold text-yellow-800 mb-2">🎮 One Game, Your Pace</h3>
        <p className="text-sm text-yellow-700">
          The chores don't change - they need to get done regardless! Our game makes them fun and brings you closer together. Play at whatever intensity feels right for you two.
        </p>
      </div>

      <div>
        <Label className="text-lg font-semibold">Notification Preferences</Label>
        <div className="space-y-3 mt-3">
          {[
            { key: 'daily', label: 'Daily questions and check-ins', emoji: '💬' },
            { key: 'verification', label: 'Task verification requests', emoji: '✅' },
            { key: 'encouragement', label: 'Motivational messages', emoji: '🎉' }
          ].map(notif => (
            <div key={notif.key} className="flex items-center space-x-3 p-3 border rounded-lg">
              <Button
                variant={onboardingData.notificationPreferences[notif.key] ? 'default' : 'outline'}
                onClick={() => handleInputChange('notificationPreferences', {
                  ...onboardingData.notificationPreferences,
                  [notif.key]: !onboardingData.notificationPreferences[notif.key]
                })}
                className="w-12 h-12"
              >
                {notif.emoji}
              </Button>
              <div className="flex-1">
                <span className="font-medium">{notif.label}</span>
                <div className="text-xs text-gray-500 mt-1">
                  {notif.key === 'daily' && 'Get fun couple questions and daily check-ins'}
                  {notif.key === 'verification' && 'Be notified when your partner completes tasks'}
                  {notif.key === 'encouragement' && 'Receive motivational messages and celebrations'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">🎉 Adventure Ready!</h2>
        <p className="text-gray-600">Review your setup and launch your game</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>📋 Your Adventure Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><strong>Hero Name:</strong> {onboardingData.playerName}</div>
          <div><strong>Living Situation:</strong> {onboardingData.livingSituation}</div>
          <div><strong>Pets:</strong> {onboardingData.hasPets ? onboardingData.petTypes.join(', ') || 'Yes' : 'None'}</div>
          <div><strong>Vehicles:</strong> {onboardingData.vehicleSharing}</div>
          <div><strong>Difficulty:</strong> {onboardingData.difficultyPreference}</div>
        </CardContent>
      </Card>

      <div className="bg-gradient-to-r from-purple-100 to-blue-100 p-6 rounded-lg text-center">
        <h3 className="text-xl font-bold mb-2">🎮 Next Steps:</h3>
        <ol className="text-left space-y-2">
          <li>1. We'll create your personalized adventure</li>
          <li>2. Generate an invitation code for your partner</li>
          <li>3. Share the code so they can join</li>
          <li>4. Start your gamified journey together!</li>
        </ol>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">
            🚀 Adventure Setup - Step {step} of {totalSteps}
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-6">
          {renderProgressBar()}
          
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
          {step === 6 && renderStep6()}
          
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={step === 1}
            >
              ← Previous
            </Button>
            
            <Button
              onClick={nextStep}
              disabled={step === 1 && !onboardingData.playerName.trim()}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white"
            >
              {step === totalSteps ? '🚀 Create Adventure!' : 'Next →'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedOnboarding;