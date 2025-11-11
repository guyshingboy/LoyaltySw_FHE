import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';
import { ethers } from 'ethers';

interface LoyaltySwapData {
  id: string;
  name: string;
  encryptedPoints: string;
  exchangeRate: number;
  brand: string;
  timestamp: number;
  creator: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [swaps, setSwaps] = useState<LoyaltySwapData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingSwap, setCreatingSwap] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending", 
    message: "" 
  });
  const [newSwapData, setNewSwapData] = useState({ 
    name: "", 
    points: "", 
    exchangeRate: "",
    brand: ""
  });
  const [selectedSwap, setSelectedSwap] = useState<LoyaltySwapData | null>(null);
  const [decryptedPoints, setDecryptedPoints] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBrand, setFilterBrand] = useState("all");
  const [userHistory, setUserHistory] = useState<any[]>([]);

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected) return;
      if (isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const swapsList: LoyaltySwapData[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          swapsList.push({
            id: businessId,
            name: businessData.name,
            encryptedPoints: businessId,
            exchangeRate: Number(businessData.publicValue1) || 0,
            brand: businessData.description,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading business data:', e);
        }
      }
      
      setSwaps(swapsList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const createSwap = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingSwap(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating loyalty swap with FHE encryption..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const pointsValue = parseInt(newSwapData.points) || 0;
      const businessId = `swap-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, pointsValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newSwapData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newSwapData.exchangeRate) || 0,
        0,
        newSwapData.brand
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction confirmation..." });
      await tx.wait();
      
      setUserHistory(prev => [...prev, {
        type: 'create',
        id: businessId,
        name: newSwapData.name,
        timestamp: Date.now()
      }]);
      
      setTransactionStatus({ visible: true, status: "success", message: "Loyalty swap created successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewSwapData({ name: "", points: "", exchangeRate: "", brand: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingSwap(false); 
    }
  };

  const decryptPoints = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Points already verified on-chain" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption on-chain..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      setUserHistory(prev => [...prev, {
        type: 'decrypt',
        id: businessId,
        points: Number(clearValue),
        timestamp: Date.now()
      }]);
      
      setTransactionStatus({ visible: true, status: "success", message: "Points decrypted and verified successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Points are already verified on-chain" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        await loadData();
        return null;
      }
      
      setTransactionStatus({ 
        visible: true, 
        status: "error", 
        message: "Decryption failed: " + (e.message || "Unknown error") 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const testIsAvailable = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const result = await contract.isAvailable();
      setTransactionStatus({ 
        visible: true, 
        status: "success", 
        message: "Contract is available and working!" 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Contract test failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const filteredSwaps = swaps.filter(swap => {
    const matchesSearch = swap.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         swap.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBrand = filterBrand === "all" || swap.brand === filterBrand;
    return matchesSearch && matchesBrand;
  });

  const brands = Array.from(new Set(swaps.map(swap => swap.brand)));

  const stats = {
    totalSwaps: swaps.length,
    verifiedSwaps: swaps.filter(s => s.isVerified).length,
    totalPoints: swaps.reduce((sum, s) => sum + (s.decryptedValue || 0), 0),
    activeBrands: brands.length
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>Confidential Loyalty Swap 🔐</h1>
            <p>積分隱私互換 - FHE Protected</p>
          </div>
          <div className="header-actions">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">🔒</div>
            <h2>Connect Wallet to Start Private Point Swaps</h2>
            <p>Securely exchange loyalty points between brands using Fully Homomorphic Encryption</p>
            <div className="feature-grid">
              <div className="feature-card">
                <div className="feature-icon">🔄</div>
                <h3>Private Swaps</h3>
                <p>Brands never see competitor's point values</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🔐</div>
                <h3>FHE Encryption</h3>
                <p>Points encrypted with Zama FHE technology</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">💫</div>
                <h3>Secure Exchange</h3>
                <p>Homomorphic computation protects privacy</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE Encryption System...</p>
        <p className="loading-note">Securing your loyalty points with homomorphic encryption</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading confidential swap system...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-section">
          <h1>Confidential Loyalty Swap</h1>
          <p>積分隱私互換 • FHE Protected Exchange</p>
        </div>
        
        <div className="header-controls">
          <button onClick={testIsAvailable} className="test-btn">
            Test Contract
          </button>
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-btn"
          >
            + New Swap
          </button>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </div>
      </header>

      <div className="main-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🔄</div>
            <div className="stat-content">
              <h3>Total Swaps</h3>
              <div className="stat-value">{stats.totalSwaps}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔐</div>
            <div className="stat-content">
              <h3>Verified Points</h3>
              <div className="stat-value">{stats.verifiedSwaps}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⭐</div>
            <div className="stat-content">
              <h3>Total Points</h3>
              <div className="stat-value">{stats.totalPoints}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏢</div>
            <div className="stat-content">
              <h3>Active Brands</h3>
              <div className="stat-value">{stats.activeBrands}</div>
            </div>
          </div>
        </div>

        <div className="content-panels">
          <div className="swap-panel">
            <div className="panel-header">
              <h2>Available Point Swaps</h2>
              <div className="panel-controls">
                <div className="search-box">
                  <input 
                    type="text" 
                    placeholder="Search swaps..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <select 
                  value={filterBrand} 
                  onChange={(e) => setFilterBrand(e.target.value)}
                  className="brand-filter"
                >
                  <option value="all">All Brands</option>
                  {brands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
                <button onClick={loadData} className="refresh-btn">
                  Refresh
                </button>
              </div>
            </div>

            <div className="swaps-list">
              {filteredSwaps.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔍</div>
                  <p>No loyalty swaps found</p>
                  <button 
                    className="create-btn" 
                    onClick={() => setShowCreateModal(true)}
                  >
                    Create First Swap
                  </button>
                </div>
              ) : (
                filteredSwaps.map((swap, index) => (
                  <div 
                    key={swap.id}
                    className={`swap-item ${selectedSwap?.id === swap.id ? 'selected' : ''}`}
                    onClick={() => setSelectedSwap(swap)}
                  >
                    <div className="swap-header">
                      <h3>{swap.name}</h3>
                      <span className={`status-badge ${swap.isVerified ? 'verified' : 'pending'}`}>
                        {swap.isVerified ? '✅ Verified' : '🔓 Encrypted'}
                      </span>
                    </div>
                    <div className="swap-details">
                      <div className="detail">
                        <span>Brand:</span>
                        <strong>{swap.brand}</strong>
                      </div>
                      <div className="detail">
                        <span>Exchange Rate:</span>
                        <strong>1:{swap.exchangeRate}</strong>
                      </div>
                      <div className="detail">
                        <span>Points:</span>
                        <strong>
                          {swap.isVerified ? 
                            `${swap.decryptedValue} points` : 
                            '🔒 FHE Encrypted'
                          }
                        </strong>
                      </div>
                    </div>
                    <div className="swap-footer">
                      <span className="creator">
                        by {swap.creator.substring(0, 8)}...
                      </span>
                      <span className="timestamp">
                        {new Date(swap.timestamp * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="history-panel">
            <div className="panel-header">
              <h2>Your Activity History</h2>
            </div>
            <div className="history-list">
              {userHistory.slice(-5).reverse().map((record, index) => (
                <div key={index} className="history-item">
                  <div className="history-type">{record.type === 'create' ? '📝 Created' : '🔓 Decrypted'}</div>
                  <div className="history-details">
                    {record.type === 'create' ? (
                      <span>New swap: {record.name}</span>
                    ) : (
                      <span>Points: {record.points}</span>
                    )}
                  </div>
                  <div className="history-time">
                    {new Date(record.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              {userHistory.length === 0 && (
                <div className="empty-history">
                  <p>No activity yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="info-panel">
          <h3>How FHE Protects Your Points</h3>
          <div className="fhe-steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h4>Encrypt Points</h4>
                <p>Loyalty points are encrypted using FHE before submission</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h4>Private Computation</h4>
                <p>Exchange rates computed on encrypted data without decryption</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h4>Secure Verification</h4>
                <p>Only you can decrypt and verify the final point values</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateSwapModal 
          onSubmit={createSwap} 
          onClose={() => setShowCreateModal(false)} 
          creating={creatingSwap} 
          swapData={newSwapData} 
          setSwapData={setNewSwapData}
          isEncrypting={isEncrypting}
        />
      )}

      {selectedSwap && (
        <SwapDetailModal 
          swap={selectedSwap} 
          onClose={() => { 
            setSelectedSwap(null); 
            setDecryptedPoints(null); 
          }} 
          decryptedPoints={decryptedPoints} 
          isDecrypting={isDecrypting || fheIsDecrypting} 
          decryptPoints={() => decryptPoints(selectedSwap.id)}
        />
      )}

      {transactionStatus.visible && (
        <div className={`transaction-toast ${transactionStatus.status}`}>
          <div className="toast-content">
            <div className="toast-icon">
              {transactionStatus.status === "pending" && "⏳"}
              {transactionStatus.status === "success" && "✅"}
              {transactionStatus.status === "error" && "❌"}
            </div>
            <div className="toast-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const CreateSwapModal: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  swapData: any;
  setSwapData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, swapData, setSwapData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'points') {
      const intValue = value.replace(/[^\d]/g, '');
      setSwapData({ ...swapData, [name]: intValue });
    } else {
      setSwapData({ ...swapData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Create New Loyalty Swap</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <div className="notice-icon">🔐</div>
            <div>
              <strong>FHE Encrypted Points</strong>
              <p>Point values are encrypted and never exposed to other brands</p>
            </div>
          </div>
          
          <div className="form-group">
            <label>Swap Name *</label>
            <input 
              type="text" 
              name="name" 
              value={swapData.name} 
              onChange={handleChange} 
              placeholder="Enter swap name..." 
            />
          </div>
          
          <div className="form-group">
            <label>Loyalty Points (Integer) *</label>
            <input 
              type="number" 
              name="points" 
              value={swapData.points} 
              onChange={handleChange} 
              placeholder="Enter points to swap..." 
              min="0"
            />
            <div className="input-hint">FHE Encrypted Integer</div>
          </div>
          
          <div className="form-group">
            <label>Exchange Rate *</label>
            <input 
              type="number" 
              name="exchangeRate" 
              value={swapData.exchangeRate} 
              onChange={handleChange} 
              placeholder="Enter exchange rate..." 
              min="1"
            />
          </div>
          
          <div className="form-group">
            <label>Brand Name *</label>
            <input 
              type="text" 
              name="brand" 
              value={swapData.brand} 
              onChange={handleChange} 
              placeholder="Enter your brand..." 
            />
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={creating || isEncrypting || !swapData.name || !swapData.points || !swapData.exchangeRate || !swapData.brand} 
            className="submit-btn"
          >
            {creating || isEncrypting ? "Encrypting..." : "Create Swap"}
          </button>
        </div>
      </div>
    </div>
  );
};

const SwapDetailModal: React.FC<{
  swap: LoyaltySwapData;
  onClose: () => void;
  decryptedPoints: number | null;
  isDecrypting: boolean;
  decryptPoints: () => Promise<number | null>;
}> = ({ swap, onClose, decryptedPoints, isDecrypting, decryptPoints }) => {
  const handleDecrypt = async () => {
    if (decryptedPoints !== null) return;
    await decryptPoints();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content large">
        <div className="modal-header">
          <h2>Swap Details</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="modal-body">
          <div className="swap-info-grid">
            <div className="info-item">
              <label>Swap Name</label>
              <div className="info-value">{swap.name}</div>
            </div>
            <div className="info-item">
              <label>Brand</label>
              <div className="info-value">{swap.brand}</div>
            </div>
            <div className="info-item">
              <label>Exchange Rate</label>
              <div className="info-value">1:{swap.exchangeRate}</div>
            </div>
            <div className="info-item">
              <label>Created</label>
              <div className="info-value">{new Date(swap.timestamp * 1000).toLocaleString()}</div>
            </div>
          </div>
          
          <div className="points-section">
            <h3>Loyalty Points</h3>
            <div className="points-display">
              <div className="points-value">
                {swap.isVerified ? 
                  `${swap.decryptedValue} points` : 
                  decryptedPoints !== null ? 
                  `${decryptedPoints} points` : 
                  '🔒 Encrypted with FHE'
                }
              </div>
              <div className="points-status">
                Status: {swap.isVerified ? '✅ On-chain Verified' : '🔐 FHE Encrypted'}
              </div>
            </div>
            
            {!swap.isVerified && (
              <button 
                className={`decrypt-btn ${decryptedPoints !== null ? 'decrypted' : ''}`}
                onClick={handleDecrypt}
                disabled={isDecrypting}
              >
                {isDecrypting ? 'Decrypting...' : 
                 decryptedPoints !== null ? '✅ Decrypted' : '🔓 Decrypt Points'}
              </button>
            )}
          </div>
          
          <div className="fhe-explanation">
            <h4>FHE Protection Process</h4>
            <div className="explanation-steps">
              <div className="step">
                <span>1.</span>
                <p>Points encrypted using Zama FHE before submission</p>
              </div>
              <div className="step">
                <span>2.</span>
                <p>Encrypted data stored on-chain, accessible for computation</p>
              </div>
              <div className="step">
                <span>3.</span>
                <p>Only swap creator can decrypt and verify the actual values</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;


