import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface SwapData {
  id: string;
  name: string;
  encryptedPoints: string;
  publicRate: number;
  description: string;
  timestamp: number;
  creator: string;
  isVerified?: boolean;
  decryptedValue?: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [swaps, setSwaps] = useState<SwapData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingSwap, setCreatingSwap] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending", 
    message: "" 
  });
  const [newSwapData, setNewSwapData] = useState({ name: "", points: "", rate: "", description: "" });
  const [selectedSwap, setSelectedSwap] = useState<SwapData | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected || isInitialized || fhevmInitializing) return;
      
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
      const swapsList: SwapData[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          swapsList.push({
            id: businessId,
            name: businessData.name,
            encryptedPoints: businessId,
            publicRate: Number(businessData.publicValue1) || 0,
            description: businessData.description,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
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
    setTransactionStatus({ visible: true, status: "pending", message: "Creating loyalty swap with FHE..." });
    
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
        parseInt(newSwapData.rate) || 0,
        0,
        newSwapData.description
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Swap created successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewSwapData({ name: "", points: "", rate: "", description: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected" 
        : "Creation failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingSwap(false); 
    }
  };

  const decryptData = async (businessId: string): Promise<number | null> => {
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
        setTransactionStatus({ visible: true, status: "success", message: "Data already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
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
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Data decrypted successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ visible: true, status: "success", message: "Data is already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        await loadData();
        return null;
      }
      
      setTransactionStatus({ status: "error", message: "Decryption failed: " + (e.message || "Unknown error"), visible: true });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const checkAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      setTransactionStatus({ visible: true, status: "success", message: "Contract is available!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const filteredSwaps = swaps.filter(swap => {
    const matchesSearch = swap.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         swap.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === "all" || 
                         (activeFilter === "verified" && swap.isVerified) ||
                         (activeFilter === "unverified" && !swap.isVerified);
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: swaps.length,
    verified: swaps.filter(s => s.isVerified).length,
    totalPoints: swaps.reduce((sum, s) => sum + (s.publicRate || 0), 0),
    recent: swaps.filter(s => Date.now()/1000 - s.timestamp < 86400).length
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo-section">
            <h1>🎁 LoyaltySwap FHE</h1>
            <p>積分隱私互換 · Encrypted Points Exchange</p>
          </div>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </header>
        
        <div className="connection-prompt">
          <div className="prompt-content">
            <div className="prompt-icon">🔐</div>
            <h2>Connect Wallet to Start</h2>
            <p>Connect your wallet to access encrypted loyalty point swaps with Zama FHE technology</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE System...</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-sp-rotate"></div>
      <p>Loading encrypted swaps...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-section">
          <h1>🎁 LoyaltySwap FHE</h1>
          <p>積分隱私互換 · Privacy-Preserving Points</p>
        </div>
        
        <div className="header-controls">
          <button onClick={checkAvailability} className="avail-btn">Check Availability</button>
          <button onClick={() => setShowCreateModal(true)} className="create-btn">+ New Swap</button>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </div>
      </header>

      <div className="main-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Swaps</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.verified}</div>
            <div className="stat-label">Verified</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalPoints}</div>
            <div className="stat-label">Total Points</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.recent}</div>
            <div className="stat-label">Today</div>
          </div>
        </div>

        <div className="controls-section">
          <div className="search-filter">
            <input 
              type="text" 
              placeholder="Search swaps..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <div className="filter-buttons">
              <button 
                className={activeFilter === "all" ? "active" : ""}
                onClick={() => setActiveFilter("all")}
              >All</button>
              <button 
                className={activeFilter === "verified" ? "active" : ""}
                onClick={() => setActiveFilter("verified")}
              >Verified</button>
              <button 
                className={activeFilter === "unverified" ? "active" : ""}
                onClick={() => setActiveFilter("unverified")}
              >Unverified</button>
            </div>
          </div>
          <button onClick={loadData} disabled={isRefreshing} className="refresh-btn">
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="swaps-list">
          {filteredSwaps.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎁</div>
              <p>No loyalty swaps found</p>
              <button onClick={() => setShowCreateModal(true)} className="create-btn">Create First Swap</button>
            </div>
          ) : (
            filteredSwaps.map((swap, index) => (
              <div 
                key={index} 
                className={`swap-item ${swap.isVerified ? 'verified' : ''} ${selectedSwap?.id === swap.id ? 'selected' : ''}`}
                onClick={() => setSelectedSwap(swap)}
              >
                <div className="swap-header">
                  <h3>{swap.name}</h3>
                  <span className={`status-badge ${swap.isVerified ? 'verified' : 'pending'}`}>
                    {swap.isVerified ? '✅ Verified' : '🔒 Encrypted'}
                  </span>
                </div>
                <p className="swap-desc">{swap.description}</p>
                <div className="swap-meta">
                  <span>Rate: {swap.publicRate}</span>
                  <span>Created: {new Date(swap.timestamp * 1000).toLocaleDateString()}</span>
                </div>
                {swap.isVerified && swap.decryptedValue && (
                  <div className="decrypted-value">Points: {swap.decryptedValue}</div>
                )}
              </div>
            ))
          )}
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
          onClose={() => setSelectedSwap(null)} 
          isDecrypting={isDecrypting || fheIsDecrypting} 
          decryptData={() => decryptData(selectedSwap.id)}
        />
      )}

      {transactionStatus.visible && (
        <div className="transaction-toast">
          <div className={`toast-content ${transactionStatus.status}`}>
            <div className="toast-icon">
              {transactionStatus.status === "pending" && <div className="spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="toast-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <p>Confidential Loyalty Swap · Powered by Zama FHE 🔐</p>
      </footer>
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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
            <strong>FHE Encryption Notice</strong>
            <p>Points will be encrypted using Zama FHE technology</p>
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
            <label>Points Amount (Integer) *</label>
            <input 
              type="number" 
              name="points" 
              value={swapData.points} 
              onChange={handleChange} 
              placeholder="Enter points amount..." 
              min="0"
            />
            <span className="input-hint">FHE Encrypted</span>
          </div>

          <div className="form-group">
            <label>Exchange Rate *</label>
            <input 
              type="number" 
              name="rate" 
              value={swapData.rate} 
              onChange={handleChange} 
              placeholder="Enter exchange rate..." 
              min="0"
            />
            <span className="input-hint">Public Data</span>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea 
              name="description" 
              value={swapData.description} 
              onChange={handleChange} 
              placeholder="Enter description..." 
              rows={3}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={creating || isEncrypting || !swapData.name || !swapData.points || !swapData.rate}
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
  swap: SwapData;
  onClose: () => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
}> = ({ swap, onClose, isDecrypting, decryptData }) => {
  const [localDecrypted, setLocalDecrypted] = useState<number | null>(null);

  const handleDecrypt = async () => {
    if (swap.isVerified) return;
    
    const result = await decryptData();
    if (result !== null) {
      setLocalDecrypted(result);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content large">
        <div className="modal-header">
          <h2>Swap Details</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="modal-body">
          <div className="detail-section">
            <h3>{swap.name}</h3>
            <p className="description">{swap.description}</p>
          </div>

          <div className="detail-grid">
            <div className="detail-item">
              <label>Creator</label>
              <span>{swap.creator.substring(0, 8)}...{swap.creator.substring(36)}</span>
            </div>
            <div className="detail-item">
              <label>Created</label>
              <span>{new Date(swap.timestamp * 1000).toLocaleString()}</span>
            </div>
            <div className="detail-item">
              <label>Exchange Rate</label>
              <span>{swap.publicRate}</span>
            </div>
            <div className="detail-item">
              <label>Status</label>
              <span className={`status ${swap.isVerified ? 'verified' : 'encrypted'}`}>
                {swap.isVerified ? 'Verified' : 'Encrypted'}
              </span>
            </div>
          </div>

          <div className="encryption-section">
            <h4>FHE Encryption Status</h4>
            <div className="encryption-status">
              <div className="status-item">
                <span className="label">Points Data:</span>
                <span className="value">
                  {swap.isVerified ? 
                    `${swap.decryptedValue} (Verified)` : 
                    localDecrypted ? 
                    `${localDecrypted} (Decrypted)` : 
                    "🔒 Encrypted"
                  }
                </span>
              </div>
              
              <button 
                onClick={handleDecrypt}
                disabled={isDecrypting || swap.isVerified}
                className={`decrypt-btn ${swap.isVerified ? 'verified' : localDecrypted ? 'decrypted' : ''}`}
              >
                {isDecrypting ? "Decrypting..." : 
                 swap.isVerified ? "Verified" : 
                 localDecrypted ? "Decrypted" : "Decrypt Points"}
              </button>
            </div>
          </div>

          {swap.isVerified && (
            <div className="verified-info">
              <div className="verified-badge">✅ On-chain Verified</div>
              <p>This swap has been successfully verified on the blockchain using FHE technology.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;