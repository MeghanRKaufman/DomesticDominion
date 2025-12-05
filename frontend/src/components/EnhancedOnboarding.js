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
    
    // Household Info
    householdType: 'roommates', // 'family', 'roommates', 'couple', 'other'
    memberLimit: 4, // 2-12+ members
    kingdomName: '',
    
    // Household Setup
    hasPets: false,
    petTypes: [],
    hasVehicle: false,
    vehicleSharing: 'none', // 'shared', 'separate', 'none'
    livingSituation: '', // 'apartment', 'house', 'other'
    householdSize: 2,
    
    // NEW: Appliance & Living Questions
    hasWasherDryer: false,
    hasDishwasher: false,
    livesUpstairs: false,
    
    // Special Needs
    hasChildren: false,
    hasElderly: false,
    hasSpecialNeeds: false,
    specialNeedsDetails: '',
    
    // Chore Preferences
    selectedChoreCategories: [],
    customChores: [],
    
    // Communication Preferences
    notificationPreferences: {
      daily: true,
      verification: true,
      encouragement: true
    }
  });

  const totalSteps = 8; // Welcome → Name → Household Type → Kingdom → Living → Pets → Vehicles → Summary

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
    "Johnson Oak Street Kingdom", "The Miller-Garcia Castle", "Saralex Dynasty", "Johnmiller Estate",
    "The Smith & Jones Realm", "Maple Avenue Manor", "Branson Pine Street", "The Rodriguez-Kim Adventures"
  ];

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-4">👑</div>
        <h2 className="text-3xl font-bold mb-4 text-purple-600">Congratulations!</h2>
        <p className="text-lg text-gray-700 mb-4">
          Great choice on accepting your quest to lead your kingdom! This is a journey of great wealth and fortune in all aspects of your household adventure.
        </p>
      </div>
      
      <div className="bg-gradient-to-r from-purple-100 to-blue-100 p-6 rounded-lg">
        <h3 className="text-xl font-bold mb-4 text-purple-800">🏰 Let's Set Up Your Kingdom</h3>
        <p className="text-gray-700">
          We'll ask you a few simple questions to customize your adventure perfectly for your household. This will help us create the right quests, rewards, and challenges for you and your partner.
        </p>
      </div>
      
      <div className="bg-green-50 p-4 rounded-lg text-center">
        <h3 className="font-bold text-green-800 mb-2">🎮 Ready to Begin?</h3>
        <p className="text-sm text-green-700">
          This will only take a few minutes and you can always change settings later!
        </p>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">👋 What's Your Name?</h2>
        <p className="text-gray-600">Let's get to know you, future champion!</p>
      </div>
      
      <div>
        <Label htmlFor="playerName">🏷️ Your First Name</Label>
        <Input
          id="playerName"
          value={onboardingData.playerName}
          onChange={(e) => handleInputChange('playerName', e.target.value)}
          placeholder="Enter your first name"
          className="text-lg"
        />
      </div>
      
      <div className="bg-yellow-50 p-4 rounded-lg">
        <h3 className="font-bold mb-2">🤝 How This Works:</h3>
        <ul className="text-sm space-y-1">
          <li>1. You'll create your household "Kingdom"</li>
          <li>2. Set up tasks that fit your living situation</li>
          <li>3. Invite your partner to join the adventure</li>
          <li>4. Start completing quests together and level up!</li>
        </ul>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">👥 Your Partner's Name</h2>
        <p className="text-gray-600">What should we call your partner in the royal invitation?</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="partnerName">Partner's Name</Label>
          <Input
            id="partnerName"
            type="text"
            placeholder="Enter your partner's name"
            value={onboardingData.partnerName || ''}
            onChange={(e) => handleInputChange('partnerName', e.target.value)}
            className="text-lg p-4 text-center"
          />
        </div>
        
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-700">
            💡 <strong>Tip:</strong> This name will appear in your royal invitation and throughout the game when referring to your partner.
          </p>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">👑 Name Your Kingdom</h2>
        <p className="text-gray-600">What should we call your household adventure?</p>
      </div>
      
      <div>
        <Label htmlFor="kingdomName" className="text-lg font-semibold">🏰 Your Kingdom Name</Label>
        <Input
          id="kingdomName"
          value={onboardingData.kingdomName || ''}
          onChange={(e) => handleInputChange('kingdomName', e.target.value)}
          placeholder="e.g., The Johnson Castle, Oak Street Kingdom"
          className="text-lg mt-2"
        />
      </div>
      
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-bold mb-3 text-blue-800">💡 Kingdom Name Ideas:</h4>
        <div className="text-sm text-blue-700 space-y-2">
          <div>
            <strong>Last name + Street name:</strong>
            <div className="ml-2 text-gray-600">"Johnson Oak Street Kingdom" or "Miller Maple Ave Estate"</div>
          </div>
          <div>
            <strong>Combined last names:</strong>
            <div className="ml-2 text-gray-600">"The Smith-Jones Castle" or "Miller & Garcia Dynasty"</div>
          </div>
          <div>
            <strong>Celebrity couple style (like "Brangelina"):</strong>
            <div className="ml-2 text-gray-600">"Johnmiller Kingdom" (John + Miller) or "Saralex Estate" (Sarah + Alex)</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
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

      <div>
        <Label className="text-lg font-semibold">Do you have a washer and dryer at home?</Label>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <Button
            variant={onboardingData.hasWasherDryer ? 'default' : 'outline'}
            onClick={() => handleInputChange('hasWasherDryer', true)}
            className="h-20 flex flex-col"
          >
            <div className="text-2xl mb-1">🧺</div>
            Yes
          </Button>
          <Button
            variant={!onboardingData.hasWasherDryer ? 'default' : 'outline'}
            onClick={() => handleInputChange('hasWasherDryer', false)}
            className="h-20 flex flex-col"
          >
            <div className="text-2xl mb-1">🏪</div>
            No (Laundromat)
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-lg font-semibold">Do you have a dishwasher?</Label>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <Button
            variant={onboardingData.hasDishwasher ? 'default' : 'outline'}
            onClick={() => handleInputChange('hasDishwasher', true)}
            className="h-20 flex flex-col"
          >
            <div className="text-2xl mb-1">🍽️</div>
            Yes
          </Button>
          <Button
            variant={!onboardingData.hasDishwasher ? 'default' : 'outline'}
            onClick={() => handleInputChange('hasDishwasher', false)}
            className="h-20 flex flex-col"
          >
            <div className="text-2xl mb-1">🧽</div>
            No (Hand wash)
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-lg font-semibold">Do you live upstairs?</Label>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <Button
            variant={onboardingData.livesUpstairs ? 'default' : 'outline'}
            onClick={() => handleInputChange('livesUpstairs', true)}
            className="h-20 flex flex-col"
          >
            <div className="text-2xl mb-1">🏢⬆️</div>
            Yes
          </Button>
          <Button
            variant={!onboardingData.livesUpstairs ? 'default' : 'outline'}
            onClick={() => handleInputChange('livesUpstairs', false)}
            className="h-20 flex flex-col"
          >
            <div className="text-2xl mb-1">🏠</div>
            No (Ground level)
          </Button>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg text-center">
        <h3 className="text-lg font-bold text-blue-800 mb-2">🏠 Household Adventure</h3>
        <p className="text-sm text-blue-700">
          This game works for couples, roommates, or families working together to conquer household tasks!
        </p>
        <div className="mt-3 text-2xl">👥</div>
      </div>
    </div>
  );

  const renderStep6 = () => (
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

  const renderStep7 = () => (
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

  const renderInvitation = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">🏰 Royal Decree Prepared!</h2>
        <p className="text-gray-600">Summon your partner to join your dominion</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>📜 Royal Partner Summons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><strong>Royal Invitation Code:</strong> ABC123</div>
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg border-2 border-purple-200">
            <div className="text-center space-y-3">
              <p className="font-bold text-purple-800">By royal decree and the will of partnership,</p>
              <p className="text-gray-700">
                You are hereby invited to enter the world of Domestic Dominion — where everyday deeds become quests, and teamwork turns routine into triumph.
              </p>
              <p className="text-gray-700">
                {onboardingData.playerName} awaits your arrival at the gates of your shared kingdom '{onboardingData.kingdomName}'. Together, you shall rise through the ranks, earn your titles, and craft a life of love and legacy.
              </p>
              <p className="font-bold text-lg text-purple-800">🏆 Do you accept this quest, Champion?</p>
              <div className="bg-white p-3 rounded border mt-4">
                <p className="text-sm font-mono">Invitation Code: ABC123</p>
              </div>
            </div>
          </div>
          <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">📋 Copy Royal Decree</Button>
        </CardContent>
      </Card>

      <div className="bg-gradient-to-r from-purple-100 to-blue-100 p-6 rounded-lg text-center">
        <h3 className="text-xl font-bold mb-2">🎭 Next Steps:</h3>
        <ol className="text-left space-y-2 text-sm">
          <li>1. Share the royal decree with your partner</li>
          <li>2. They can join using "I was invited to an adventure"</li>
          <li>3. Once they accept, you'll both rule your dominion together!</li>
        </ol>
      </div>
    </div>
  );

  const renderSummary = () => (
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
          <div><strong>👋 Your Name:</strong> {onboardingData.playerName}</div>
          <div><strong>👑 Kingdom Name:</strong> {onboardingData.kingdomName}</div>
          <div><strong>🏠 Living Situation:</strong> {onboardingData.livingSituation?.charAt(0).toUpperCase() + onboardingData.livingSituation?.slice(1)}</div>
          <div><strong>🐾 Pets:</strong> {onboardingData.hasPets ? onboardingData.petTypes.join(', ') || 'Yes' : 'None'}</div>
          <div><strong>🚗 Vehicles:</strong> {onboardingData.vehicleSharing === 'none' ? 'No vehicles' : onboardingData.vehicleSharing === 'shared' ? 'Shared vehicle(s)' : 'Separate vehicles'}</div>
          <div><strong>📱 Notifications:</strong> {Object.entries(onboardingData.notificationPreferences).filter(([k,v]) => v).map(([k,v]) => k).join(', ') || 'None selected'}</div>
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
          {step === 7 && renderStep7()}
          {step === 8 && renderSummary()}
          {step === 9 && renderInvitation()}
          
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
              disabled={(step === 2 && !onboardingData.playerName?.trim()) || (step === 3 && !onboardingData.partnerName?.trim()) || (step === 4 && !onboardingData.kingdomName?.trim())}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white"
            >
              {step === totalSteps ? '🚀 Start Playing!' : step === totalSteps - 1 ? 'Create Kingdom!' : 'Next →'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedOnboarding;