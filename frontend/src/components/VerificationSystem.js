import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';

// Enhanced Verification System
function VerificationSystem({ 
  quest, 
  currentUser, 
  partner, 
  onVerificationComplete, 
  onClose 
}) {
  const [verificationStep, setVerificationStep] = useState('select-method');
  const [beforePhoto, setBeforePhoto] = useState('');
  const [afterPhoto, setAfterPhoto] = useState('');
  const [partnerVerification, setPartnerVerification] = useState(false);
  const [verificationNote, setVerificationNote] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Determine verification requirements based on quest type
  const getVerificationRequirements = () => {
    const questTitle = quest.title.toLowerCase();
    
    // High verification tasks (before/after photos required)
    const highVerificationTasks = [
      'drink', 'water', 'exercise', 'stretch', 'meditation', 'walk', 
      'clean', 'organize', 'vacuum', 'dishes', 'laundry', 'cook'
    ];
    
    // Partner verification required tasks
    const partnerVerificationTasks = [
      'massage', 'hug', 'conversation', 'date', 'quality time'
    ];
    
    const needsPhotoProof = highVerificationTasks.some(task => questTitle.includes(task));
    const needsPartnerConfirm = partnerVerificationTasks.some(task => questTitle.includes(task)) || quest.room === 'US';
    const isHighStakes = quest.difficulty === 'HARD' || quest.basePoints >= 20;
    
    return {
      needsPhotoProof: needsPhotoProof || isHighStakes,
      needsPartnerConfirm,
      requiresBoth: needsPartnerConfirm && needsPhotoProof
    };
  };

  const requirements = getVerificationRequirements();

  const handlePhotoUpload = (type, file) => {
    if (!file) return;
    
    setIsUploading(true);
    
    // Simulate photo upload (in real app, upload to cloud storage)
    const reader = new FileReader();
    reader.onload = (e) => {
      if (type === 'before') {
        setBeforePhoto(e.target.result);
      } else {
        setAfterPhoto(e.target.result);
      }
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleVerificationSubmit = () => {
    let verificationScore = 0;
    let bonusPoints = 0;
    
    // Calculate verification completeness
    if (beforePhoto && afterPhoto) {
      verificationScore += 3;
      bonusPoints += 5; // Photo proof bonus
    } else if (beforePhoto || afterPhoto) {
      verificationScore += 2;
      bonusPoints += 2;
    }
    
    if (partnerVerification) {
      verificationScore += 3;
      bonusPoints += 5; // Partner verification bonus
    }
    
    if (verificationNote.length > 10) {
      verificationScore += 1;
      bonusPoints += 1; // Detail bonus
    }
    
    // High verification gets extra bonus
    if (verificationScore >= 5) {
      bonusPoints += 3; // Excellence bonus
    }
    
    const verificationData = {
      beforePhoto,
      afterPhoto,
      partnerVerified: partnerVerification,
      notes: verificationNote,
      verificationScore,
      bonusPoints,
      timestamp: new Date().toISOString()
    };
    
    onVerificationComplete(verificationData);
  };

  const canSubmit = () => {
    if (requirements.requiresBoth) {
      return (beforePhoto && afterPhoto && partnerVerification);
    } else if (requirements.needsPhotoProof) {
      return (beforePhoto && afterPhoto);
    } else if (requirements.needsPartnerConfirm) {
      return partnerVerification;
    } else {
      return true; // Basic tasks can submit with any verification
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">
            🔍 Quest Verification: {quest.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Verification Requirements Display */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">📋 Verification Requirements:</h4>
            <div className="space-y-2">
              {requirements.needsPhotoProof && (
                <div className="flex items-center space-x-2">
                  <Badge className={`${beforePhoto && afterPhoto ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    📸 Before & After Photos {beforePhoto && afterPhoto ? '✓' : '⚠️'}
                  </Badge>
                </div>
              )}
              {requirements.needsPartnerConfirm && (
                <div className="flex items-center space-x-2">
                  <Badge className={`${partnerVerification ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    👫 Partner Confirmation {partnerVerification ? '✓' : '⚠️'}
                  </Badge>
                </div>
              )}
              {!requirements.needsPhotoProof && !requirements.needsPartnerConfirm && (
                <Badge className="bg-green-100 text-green-800">
                  ✅ Basic Verification (Optional Enhancement)
                </Badge>
              )}
            </div>
          </div>

          {/* Photo Verification Section */}
          {requirements.needsPhotoProof && (
            <div className="space-y-4">
              <h4 className="font-semibold">📸 Photo Proof</h4>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Before Photo */}
                <div className="space-y-2">
                  <Label>Before Photo</Label>
                  {beforePhoto ? (
                    <div className="relative">
                      <img src={beforePhoto} alt="Before" className="w-full h-32 object-cover rounded border" />
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="absolute top-1 right-1"
                        onClick={() => setBeforePhoto('')}
                      >
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload('before', e.target.files[0])}
                        className="hidden"
                        id="before-photo"
                      />
                      <label htmlFor="before-photo" className="cursor-pointer">
                        <div className="text-4xl mb-2">📷</div>
                        <p className="text-sm text-gray-600">Click to upload before photo</p>
                      </label>
                    </div>
                  )}
                </div>

                {/* After Photo */}
                <div className="space-y-2">
                  <Label>After Photo</Label>
                  {afterPhoto ? (
                    <div className="relative">
                      <img src={afterPhoto} alt="After" className="w-full h-32 object-cover rounded border" />
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="absolute top-1 right-1"
                        onClick={() => setAfterPhoto('')}
                      >
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload('after', e.target.files[0])}
                        className="hidden"
                        id="after-photo"
                      />
                      <label htmlFor="after-photo" className="cursor-pointer">
                        <div className="text-4xl mb-2">📷</div>
                        <p className="text-sm text-gray-600">Click to upload after photo</p>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Partner Verification Section */}
          {requirements.needsPartnerConfirm && (
            <div className="space-y-4">
              <h4 className="font-semibold">👫 Partner Verification</h4>
              
              {partner ? (
                <div className="bg-pink-50 p-4 rounded-lg">
                  <p className="mb-3">Ask {partner.displayName} to confirm you completed this quest:</p>
                  
                  <div className="flex space-x-2">
                    <Button 
                      onClick={() => setPartnerVerification(true)}
                      className={partnerVerification ? "bg-green-500 text-white" : ""}
                      disabled={partnerVerification}
                    >
                      {partnerVerification ? '✓ Verified by Partner' : '👫 Partner Confirms'}
                    </Button>
                    
                    <Button 
                      variant="outline"
                      onClick={() => {
                        // In real app, this would send a notification to partner
                        alert(`Verification request sent to ${partner.displayName}! 📱`);
                      }}
                    >
                      📱 Send Request
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-100 p-4 rounded-lg">
                  <p className="text-gray-600">Partner verification available when both partners are connected.</p>
                  <Button 
                    onClick={() => setPartnerVerification(true)}
                    className="mt-2"
                    variant="outline"
                  >
                    Self-Verify (Reduced Bonus)
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Optional Notes Section */}
          <div className="space-y-2">
            <Label>📝 Quest Notes (Optional - Extra Bonus!)</Label>
            <textarea
              className="w-full p-2 border rounded-md"
              rows="3"
              placeholder="How did the quest go? Any challenges or fun moments?"
              value={verificationNote}
              onChange={(e) => setVerificationNote(e.target.value)}
            />
            {verificationNote.length > 10 && (
              <Badge className="bg-green-100 text-green-800">+1 bonus for detailed notes!</Badge>
            )}
          </div>

          {/* Submit Section */}
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">🎁 Verification Rewards:</h4>
              <div className="flex flex-wrap gap-2">
                <Badge>Base: +{quest.basePoints} XP</Badge>
                {beforePhoto && afterPhoto && <Badge className="bg-green-100 text-green-800">Photo Proof: +5 XP</Badge>}
                {partnerVerification && <Badge className="bg-pink-100 text-pink-800">Partner Verified: +5 XP</Badge>}
                {verificationNote.length > 10 && <Badge className="bg-blue-100 text-blue-800">Detailed Notes: +1 XP</Badge>}
                {(beforePhoto && afterPhoto && partnerVerification) && <Badge className="bg-purple-100 text-purple-800">Excellence: +3 XP</Badge>}
              </div>
            </div>

            <div className="flex space-x-2">
              <Button 
                onClick={handleVerificationSubmit}
                disabled={!canSubmit() || isUploading}
                className="flex-1"
              >
                {isUploading ? 'Uploading...' : '✅ Complete Quest!'}
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
            
            {!canSubmit() && requirements.requiresBoth && (
              <p className="text-sm text-red-600 text-center">
                This quest requires both photo proof AND partner verification to complete.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default VerificationSystem;