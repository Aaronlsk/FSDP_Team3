import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';  // Add this new line
import io from 'socket.io-client';
import AWS from '../aws-config';
import '../styles/devices.css';
import { FaEllipsisH, FaTabletAlt, FaPlus, FaBullhorn } from 'react-icons/fa';
import { FaSearch } from 'react-icons/fa';
import DeviceSwitch from '../components/DeviceSwitch';

const socket = io(process.env.REACT_APP_API_URL, {
  auth: {
      token: localStorage.getItem('token')
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.log('Connection error:', error.message);
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const Devices = () => {

  const navigate = useNavigate();  // Add this line

  // Add this new useEffect for auth
  useEffect(() => {
      socket.on('connect_error', (error) => {
          if (error.message.includes('Authentication error')) {
              console.log('Authentication failed');
              navigate('/login');
          }
      });

      return () => {
          socket.off('connect_error');
      };
  }, [navigate]);

  const [isDevicesSelected, setIsDevicesSelected] = useState(true);
  const [isAdConfirmModalOpen, setIsAdConfirmModalOpen] = useState(false);
  const [isAddDeviceModalOpen, setIsAddDeviceModalOpen] = useState(false);
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedGroupDevices, setSelectedGroupDevices] = useState(new Set());
  const [groupName, setGroupName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isViewGroupModalOpen, setIsViewGroupModalOpen] = useState(false);
  const [selectedGroupForAd, setSelectedGroupForAd] = useState(null);
  const [isGroupDisplayConfirmModalOpen, setIsGroupDisplayConfirmModalOpen] = useState(false);
  const [groupToRemove, setGroupToRemove] = useState(null);
  const [isRemoveGroupModalOpen, setIsRemoveGroupModalOpen] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [deviceName, setDeviceName] = useState('');
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [connectedDevices, setConnectedDevices] = useState([]);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [deviceAds, setDeviceAds] = useState(new Map());
  const [isDisplayModalOpen, setIsDisplayModalOpen] = useState(false);
  const [selectedDeviceForAd, setSelectedDeviceForAd] = useState(null);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [deviceToRemove, setDeviceToRemove] = useState(null);
  const [isDisplayConfirmModalOpen, setIsDisplayConfirmModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add these new states for multi-select feature
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState(new Set());
  const [isMultiDisplayModalOpen, setIsMultiDisplayModalOpen] = useState(false);

  const [ads, setAds] = useState([]);
  const [selectedAd, setSelectedAd] = useState(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [liveAd, setLiveAd] = useState(''); // State for currently live ad
  const isServerSite = window.location.hostname === 'localhost';

  // In your useEffect where you set up device listeners
  useEffect(() => {
    console.log('Setting up ad display listeners, isServerSite:', isServerSite);
    
    socket.on('display_ad', (adMediaPath) => {
      console.log('Received display_ad event:', adMediaPath);
      
      if (adMediaPath === null) {
        // Handle stopping the ad
        setIsImageModalOpen(false);
        setIsVideoModalOpen(false);
        setSelectedAd(null);
        setLiveAd('');
        return;
      }
      
      if (!isServerSite) {
        const ad = ads.find(ad => ad.url === adMediaPath);
        console.log('Matched ad:', ad);
        if (ad) {
          setSelectedAd(ad);
          if (ad.type === 'image') {
            setIsImageModalOpen(true);
          } else if (ad.type === 'video') {
            setIsVideoModalOpen(true);
          }
          setLiveAd(ad.name);
        }
      }
    });

    socket.on('ad_confirmed', () => {
      setIsAdConfirmModalOpen(false);
    });

    return () => {
      socket.off('display_ad');
      socket.off('ad_confirmed');
    };
  }, [ads, isServerSite]);

  // Rest of your existing component code stays exactly the same

  useEffect(() => {
    const fetchStoredDevices = async () => {
      try {
        const params = {
          TableName: 'Devices'
        };
        const result = await dynamoDb.scan(params).promise();
        setConnectedDevices(result.Items);
      } catch (error) {
        console.error('Error fetching stored devices:', error);
      }
    };
  
    fetchStoredDevices();
  }, []);

  useEffect(() => {
    socket.on('device_list', (devices) => {
      setConnectedDevices(devices); // Direct update instead of merging
    });

    return () => {
      socket.off('device_list');
    };
  }, []);

  useEffect(() => {
    const fetchAdsFromDynamoDB = async () => {
      const params = { TableName: 'Ads' };

      try {
        const data = await dynamoDb.scan(params).promise();
        setAds(data.Items.map(ad => ({
          id: ad.ad_id,
          name: ad.name,
          url: ad.url,
          type: ad.type,
        })));
      } catch (error) {
        console.error("Error fetching ads from DynamoDB:", error);
      }
    };

    fetchAdsFromDynamoDB();
  }, []);

  useEffect(() => {
    // Set up heartbeat
    const heartbeatInterval = setInterval(() => {
      socket.emit('heartbeat');
    }, 5000);
  
    return () => clearInterval(heartbeatInterval);
  }, []);

  useEffect(() => {
    // Announce this device's presence
    socket.emit('device_connected', navigator.userAgent);
  
    // Listen for available devices updates
    socket.on('available_devices', (devices) => {
      setAvailableDevices(devices);
    });
  
    // Set up heartbeat
    const heartbeatInterval = setInterval(() => {
      socket.emit('heartbeat');
    }, 5000);
  
    return () => {
      clearInterval(heartbeatInterval);
      socket.off('available_devices');
    };
  }, []);

  useEffect(() => {
    socket.on('device_ad_update', ({ deviceId, ad }) => {
      setDeviceAds(prev => {
        const newDeviceAds = new Map(prev);
        if (ad) {
          newDeviceAds.set(deviceId, ad);
        } else {
          newDeviceAds.delete(deviceId);
        }
        return newDeviceAds;
      });
    });
  
    return () => socket.off('device_ad_update');
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.device-container')) {
        setOpenDropdown(null);
      }
    };
  
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  useEffect(() => {
    socket.on('ad_stopped', ({ deviceId }) => {
      console.log('Ad stopped for device:', deviceId);
      
      setDeviceAds(prev => {
        const newDeviceAds = new Map(prev);
        // Only remove ad for specific device
        if (deviceId !== 'all') {
          newDeviceAds.delete(deviceId);
        } else {
          // Clear all ads only for global stop
          newDeviceAds.clear();
        }
        return newDeviceAds;
      });
  
      if (!isServerSite && socket.id === deviceId) {
        setIsImageModalOpen(false);
        setIsVideoModalOpen(false);
        setSelectedAd(null);
      }
    });
  
    return () => socket.off('ad_stopped');
  }, [isServerSite]);

  useEffect(() => {
    socket.on('groups_list', (newGroups) => {
      setGroups(newGroups);
    });
  
    // Initial fetch
    const fetchGroups = async () => {
      try {
        const result = await dynamoDb.scan({ TableName: 'TV_Groups' }).promise();
        setGroups(result.Items);
      } catch (error) {
        console.error('Error fetching groups:', error);
      }
    };
  
    fetchGroups();
  
    return () => socket.off('groups_list');
  }, []);

  const filteredDevices = connectedDevices.filter(device => 
    device.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // All Ads Functions
  const handleShowAdClick = () => {
    setIsDisplayModalOpen(true);  // Reuse display modal
    setSelectedDeviceForAd(null); // No specific device
  };

  const confirmShowAd = () => {
    if (selectedAd && selectedAd.url) {
      socket.emit('trigger_ad', selectedAd.url);
      
      // Update deviceAds map for all connected devices
      const newDeviceAds = new Map(deviceAds);
      connectedDevices.forEach(device => {
        if (device.status === 'Connected') {
          newDeviceAds.set(device.socketId, selectedAd);
        }
      });
      setDeviceAds(newDeviceAds);
      
      setIsDisplayModalOpen(false);
      setSelectedAd(null);
    } else {
      alert("Please select an ad to display.");
    }
  };

  // All Devices Functions
  const openAddDeviceModal = () => setIsAddDeviceModalOpen(true);

  const closeAddDeviceModal = () => {
    setIsAddDeviceModalOpen(false);
    setDeviceName('');
  };

  const confirmAddDevice = async () => {
    if (!selectedDevice) {
      alert("Please select a device.");
      return;
    }

    // Generate a stable device ID using device info
    const deviceId = `${selectedDevice.info.device}_${selectedDevice.info.browser}_${selectedDevice.info.os}_${selectedDevice.ip}`.replace(/[^a-zA-Z0-9]/g, '_');
    
    const name = deviceName.trim() || `${selectedDevice.info.device}_${deviceId.slice(0, 6)}`;

    const deviceDetails = {
      deviceId: deviceId,  // Use stable deviceId instead of socketId
      name: name,
      socketId: selectedDevice.socketId,  // Keep track of current socketId
      info: selectedDevice.info,
      status: 'Connected',
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const params = {
        TableName: 'Devices',
        Item: deviceDetails
      };
      
      await dynamoDb.put(params).promise();
      
      socket.emit('register_device', { 
        ...deviceDetails,
        deviceName: name
      });
      
      closeAddDeviceModal();
    } catch (error) {
      console.error('Error storing device:', error);
      alert('Failed to add device. Please try again.');
    }
  };

  const toggleDropdown = (deviceName) => {
    setOpenDropdown((prev) => (prev === deviceName ? null : deviceName));
  };  

  const handleViewDevice = (device) => {
    setSelectedDevice(device);
    setIsViewModalOpen(true);
    setOpenDropdown(null);
  };
  
  const handleDisplayAd = (device) => {
      const isDisplaying = deviceAds.has(device.socketId);
      if (device.status === 'Disconnected') {
          alert('This device needs to be connected before displaying ads.');
          return;
      }
      if (isDisplaying) {
          setSelectedDeviceForAd(device);
          setIsDisplayConfirmModalOpen(true);
      } else {
          setSelectedDeviceForAd(device);
          setIsDisplayModalOpen(true);
      }
      setOpenDropdown(null);
  };
  
  const handleRemoveDevice = (device) => {
    setDeviceToRemove(device);
    setIsRemoveModalOpen(true);
    setOpenDropdown(null);
  };
  
  const confirmRemoveDevice = async () => {
    if (!deviceToRemove) return;
    
    try {
        const params = {
            TableName: 'Devices',
            Key: {
                deviceId: deviceToRemove.deviceId
            }
        };
        
        await dynamoDb.delete(params).promise();
        setConnectedDevices(prevDevices => 
            prevDevices.filter(d => d.deviceId !== deviceToRemove.deviceId)
        );
        
        socket.emit('remove_device', deviceToRemove.deviceId);
        
        setIsRemoveModalOpen(false);
        setDeviceToRemove(null);
    } catch (error) {
        console.error('Error removing device:', error);
        alert('Failed to remove device. Please try again.');
    }
  };

  const confirmDisplayAd = () => {
    if (selectedAd && selectedDeviceForAd) {
      socket.emit('trigger_device_ad', {
        deviceId: selectedDeviceForAd.socketId,
        adUrl: selectedAd.url,
        ad: selectedAd // Send full ad object
      });
      
      // Update device ads map
      const newDeviceAds = new Map(deviceAds);
      newDeviceAds.set(selectedDeviceForAd.socketId, selectedAd);
      setDeviceAds(newDeviceAds);
      
      setIsDisplayModalOpen(false);
      setSelectedDeviceForAd(null);
    } else {
      alert("Please select an ad to display.");
    }
  };

  const handleDeviceSelection = (deviceId) => {
    if (!isSelectMode) return;
    
    const device = connectedDevices.find(d => d.socketId === deviceId);
    if (device?.status === 'Disconnected') return;
  
    setSelectedDevices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deviceId)) {
        newSet.delete(deviceId);
      } else {
        newSet.add(deviceId);
      }
      return newSet;
    });
  };

  const confirmMultiDisplayAd = () => {
    if (!selectedAd) {
      alert('Please select an ad to display');
      return;
    }
  
    const newDeviceAds = new Map(deviceAds);
  
    // For groups display
    if (!isDevicesSelected) {
      selectedGroups.forEach(groupId => {
        const group = groups.find(g => g.tv_group_id === groupId);
        group.deviceIds.forEach(deviceId => {
          const device = connectedDevices.find(d => d.deviceId === deviceId);
          if (device && device.status === 'Connected') {
            socket.emit('trigger_device_ad', {
              deviceId: device.socketId,
              adUrl: selectedAd.url,
              ad: selectedAd
            });
            newDeviceAds.set(device.socketId, selectedAd);
          }
        });
      });
    } else {
      selectedDevices.forEach(deviceId => {
        socket.emit('trigger_device_ad', {
          deviceId,
          adUrl: selectedAd.url,
          ad: selectedAd
        });
        newDeviceAds.set(deviceId, selectedAd);
      });
    }
  
    setDeviceAds(newDeviceAds);
    setIsMultiDisplayModalOpen(false);
    setIsSelectMode(false);
    setSelectedDevices(new Set());
    setSelectedGroups(new Set());
    setSelectedAd(null);
  };

  const confirmStopDisplay = () => {
    if (selectedDeviceForAd) {
      socket.emit('stop_device_ad', selectedDeviceForAd.socketId);
      setIsDisplayConfirmModalOpen(false);
      setSelectedDeviceForAd(null);
    }
  };
  
  // All Groups Functions
  const openAddGroupModal = () => setIsAddGroupModalOpen(true);
  
  const closeAddGroupModal = () => {
    setIsAddGroupModalOpen(false);
    setSelectedGroupDevices(new Set());
    setGroupName('');
  };

  const confirmAddGroup = () => {
  if (selectedGroupDevices.size < 2) {
    alert("Please select at least 2 devices for the group");
    return;
  }

  if (!groupName.trim()) {
    alert("Please enter a group name");
    return;
  }

  const groupData = {
    tv_group_id: `group_${Date.now()}`,
    name: groupName.trim(),
    deviceIds: Array.from(selectedGroupDevices),
    createdAt: new Date().toISOString()
  };

  socket.emit('create_group', groupData);
  closeAddGroupModal();
};

const filteredGroups = groups.filter(group => 
  group.name.toLowerCase().includes(searchQuery.toLowerCase())
);

const handleViewGroup = (group) => {
  setSelectedGroup(group);
  setIsViewGroupModalOpen(true);
  setOpenDropdown(null);
};

const handleGroupDisplay = (group) => {
  const hasDisconnectedDevices = group.deviceIds.some(deviceId => {
    const device = connectedDevices.find(d => d.deviceId === deviceId);
    return !device || device.status === 'Disconnected';
  });

  if (hasDisconnectedDevices) {
    alert('Cannot display to this group - one or more devices are disconnected');
    return;
  }

  const isDisplaying = group.deviceIds.some(deviceId => {
    const device = connectedDevices.find(d => d.deviceId === deviceId);
    return device && deviceAds.has(device.socketId);
  });

  if (isDisplaying) {
    setSelectedGroupForAd(group);
    setIsGroupDisplayConfirmModalOpen(true);
  } else {
    setSelectedGroupForAd(group);
    setIsDisplayModalOpen(true);
  }
  setOpenDropdown(null);
};
 
 const confirmStopGroupDisplay = () => {
  if (selectedGroupForAd) {
    selectedGroupForAd.deviceIds.forEach(deviceId => {
      const device = connectedDevices.find(d => d.deviceId === deviceId);
      if (device) {
        socket.emit('stop_device_ad', device.socketId);
      }
    });
    setIsGroupDisplayConfirmModalOpen(false);
    setSelectedGroupForAd(null);
  }
 };

 const handleRemoveGroup = (group) => {
  setGroupToRemove(group);
  setIsRemoveGroupModalOpen(true);
  setOpenDropdown(null);
 };
 
 const confirmRemoveGroup = async () => {
  if (!groupToRemove) return;
  
  try {
    await dynamoDb.delete({
      TableName: 'TV_Groups',
      Key: { tv_group_id: groupToRemove.tv_group_id }
    }).promise();
    
    setGroups(prevGroups => 
      prevGroups.filter(g => g.tv_group_id !== groupToRemove.tv_group_id)
    );
    
    setIsRemoveGroupModalOpen(false);
    setGroupToRemove(null);
  } catch (error) {
    console.error('Error removing group:', error);
    alert('Failed to remove group. Please try again.');
  }
 };

 const handleGroupSelection = (groupId) => {
  if (!isSelectMode) return;
  
  const group = groups.find(g => g.tv_group_id === groupId);
  const hasDisconnectedDevices = group.deviceIds.some(deviceId => {
    const device = connectedDevices.find(d => d.deviceId === deviceId);
    return !device || device.status === 'Disconnected';
  });

  if (hasDisconnectedDevices) {
    alert('Cannot select this group - one or more devices are disconnected');
    return;
  }

  setSelectedGroups(prev => {
    const newSet = new Set(prev);
    if (newSet.has(groupId)) {
      newSet.delete(groupId);
    } else {
      newSet.add(groupId);
    }
    return newSet;
  });
};

  return (
    <div className="devices">
      {/* Live Ad Banner - Display only on localhost, above media section */}
      {isServerSite && liveAd && (
        <div className="live-ad-banner" style={{
          width: '100%',
          backgroundColor: '#333',
          color: 'white',
          textAlign: 'center',
          padding: '10px',
          fontWeight: 'bold',
          marginBottom: '10px', // Adds space below the banner
        }}>
          Currently Live: {liveAd}
        </div>
      )}

      <h2 className="page-title">{isDevicesSelected ? 'Devices' : 'Groups'}</h2>

      <div className="switch-container">
        <DeviceSwitch isDevicesSelected={isDevicesSelected} onToggle={() => setIsDevicesSelected(!isDevicesSelected)} />
      </div>

      {isDevicesSelected ? (
        <>
          <div className="button-container">
            <button 
              className={`select-button ${isSelectMode ? 'active' : ''}`}
              onClick={() => {
                setIsSelectMode(!isSelectMode);
                if (isSelectMode) {
                  setSelectedDevices(new Set());
                }
              }}
            >
              <FaTabletAlt className="icon" />
              {isSelectMode ? 'Cancel Selection' : 'Select Devices'}
            </button>
            {isSelectMode ? (
              <button 
                className="ad-button"
                onClick={() => {
                  if (selectedDevices.size === 0) {
                    alert('Please select at least one device');
                    return;
                  }
                  setIsMultiDisplayModalOpen(true);
                }}
                disabled={selectedDevices.size === 0}
              >
                <FaBullhorn className="icon" />
                Display to Selected ({selectedDevices.size})
              </button>
            ) : (
              <>
                <button className="add-button" onClick={openAddDeviceModal}>
                  <FaPlus className="icon" />
                  {isDevicesSelected ? 'Add Device' : 'Add Group'}
                </button>
                <button className="ad-button" onClick={handleShowAdClick}>
                  <FaBullhorn className="icon" />
                  Show Ad
                </button>
              </>
            )}
          </div>

          <div className="search-container">
            <div className="search-box">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search devices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {connectedDevices.length === 0 ? (
            <div className="no-devices-message">There are currently no devices added.</div>
          ) : (
            <div className="device-grid">
              {filteredDevices.map((device, index) => (
                <div 
                  key={index} 
                  className={`device-container ${isSelectMode ? 'selectable' : ''} ${
                    selectedDevices.has(device.socketId) ? 'selected' : ''
                  }`}
                  onClick={() => {
                    if (isSelectMode) {
                      if (device.status === 'Disconnected') {
                        alert('Device must be connected to be selected');
                        return;
                      }
                      handleDeviceSelection(device.socketId);
                    }
                  }}
                >
                  <div className="device-header">
                    <div className="device-info">
                      <div className="device-icon">
                        <FaTabletAlt />
                      </div>
                      <div>
                        <div className="device-name">{device.name}</div>
                        <div className={`status-badge ${device.status === 'Connected' ? 'status-connected' : 'status-disconnected'}`}>
                          {device.status}
                        </div>
                      </div>
                    </div>
                    {!isSelectMode && (
                      <button
                        className="more-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDropdown(device.name);
                        }}
                      >
                        <FaEllipsisH />
                      </button>
                    )}
                    {openDropdown === device.name && !isSelectMode && (
                      <div className="dropdown-menu show">
                        <button onClick={() => handleViewDevice(device)}>View</button>
                        <button onClick={() => handleDisplayAd(device)}>
                          {deviceAds.has(device.socketId) ? 'Stop Display' : 'Display'}
                        </button>
                        <button onClick={() => handleRemoveDevice(device)}>Remove</button>
                      </div>
                    )}
                  </div>
                  
                  <div className="device-display-status">
                    {deviceAds.has(device.socketId) ? (
                      <div className="display-container active">
                        <div className="live-indicator">
                          <span className="live-dot"></span>
                          LIVE
                        </div>
                        {deviceAds.get(device.socketId).type === 'video' ? (
                          <video 
                            src={deviceAds.get(device.socketId).url} 
                            className="w-full h-full object-cover"
                            autoPlay
                            loop
                            muted
                          />
                        ) : (
                          <img 
                            src={deviceAds.get(device.socketId).url} 
                            alt="Current display" 
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="display-container empty">
                        <span>No content displayed</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
        <div className="button-container">
          <button 
            className={`select-button ${isSelectMode ? 'active' : ''}`}
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) {
                setSelectedDevices(new Set());
              }
            }}
          >
            <FaTabletAlt className="icon" />
            {isSelectMode ? 'Cancel Selection' : 'Select Groups'}
          </button>
          {isSelectMode ? (
            <button 
              className="ad-button"
              onClick={() => {
                if (selectedGroups.size === 0) {
                  alert('Please select at least one group');
                  return;
                }
                setIsMultiDisplayModalOpen(true);
              }}
              disabled={selectedGroups.size === 0}
            >
              <FaBullhorn className="icon" />
              Display to Selected ({selectedGroups.size})
            </button>
          ) : (
            <button className="add-button" onClick={openAddGroupModal}>
              <FaPlus className="icon" />
              Add Group
            </button>
          )}
        </div>

        <div className="search-container">
          <div className="search-box">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <div className="device-grid">
          {filteredGroups.map((group) => (
            <div 
              key={group.tv_group_id} 
              className={`device-container ${isSelectMode ? 'selectable' : ''} ${
                selectedGroups.has(group.tv_group_id) ? 'selected' : ''
              }`}
              onClick={() => {
                if (isSelectMode) {
                  handleGroupSelection(group.tv_group_id);
                }
              }}
            >
              <div className="device-header">
                <div className="device-info">
                  <div className="device-icon">
                    <FaTabletAlt />
                  </div>
                  <div>
                    <div className="device-name">{group.name}</div>
                    <div>Devices: {group.deviceIds.length}</div>
                  </div>
                </div>
                {!isSelectMode && (
                  <button
                    className="more-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDropdown(group.name);
                    }}
                  >
                    <FaEllipsisH />
                  </button>
                )}
                {openDropdown === group.name && !isSelectMode && (
                  <div className="dropdown-menu show">
                    <button onClick={() => handleViewGroup(group)}>View</button>
                    <button onClick={() => handleGroupDisplay(group)}>
                      {group.deviceIds.some(deviceId => {
                        const device = connectedDevices.find(d => d.deviceId === deviceId);
                        return device && deviceAds.has(device.socketId);
                      }) ? 'Stop Display' : 'Display'}
                    </button>
                    <button onClick={() => handleRemoveGroup(group)}>Remove</button>
                  </div>
                )}
              </div>
              
              <div className="device-display-status">
                {group.deviceIds.some(deviceId => {
                  const device = connectedDevices.find(d => d.deviceId === deviceId);
                  return device && deviceAds.has(device.socketId);
                }) ? (
                  <div className="display-container active">
                    <div className="live-indicator">
                      <span className="live-dot"></span>
                      LIVE
                    </div>
                    {(() => {
                      const activeDevice = connectedDevices.find(d => 
                        group.deviceIds.includes(d.deviceId) && deviceAds.has(d.socketId)
                      );
                      const activeAd = activeDevice ? deviceAds.get(activeDevice.socketId) : null;
                      
                      return activeAd?.type === 'video' ? (
                        <video 
                          src={activeAd.url} 
                          className="w-full h-full object-cover"
                          autoPlay
                          loop
                          muted
                        />
                      ) : (
                        <img 
                          src={activeAd?.url} 
                          alt="Current display" 
                          className="w-full h-full object-cover"
                        />
                      );
                    })()}
                  </div>
                ) : (
                  <div className="display-container empty">
                    <span>No content displayed</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </>
      )}


      {/* View Modal */}
      {isViewModalOpen && selectedDevice && (
        <div className="modal">
          <div className="modal-content">
            <h3 className="modal-title">Overview</h3>
            <div className="device-details">
              <p><strong>Name</strong> {selectedDevice.name}</p>
              <p><strong>Status</strong> {selectedDevice.status}</p>
              <p><strong>Operating System</strong> {selectedDevice.info.os}</p>
              <p><strong>Device Type</strong> {selectedDevice.info.device}</p>
              <p><strong>Browser</strong> {selectedDevice.info.browser}</p>
              <p><strong>Last Seen</strong> {new Date(selectedDevice.lastSeen).toLocaleString()}</p>
            </div>
            <div className="modal-actions">
              <button className="modal-button secondary-button" onClick={() => setIsViewModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Display Modal */}
      {isDisplayModalOpen && (
        <div className="modal">
          <div className="modal-content display-modal-content">
            <h3 className="modal-title">Control Center</h3>
            <div className="ad-selection">
            <h4 className="modal-subtitle">
              {selectedDeviceForAd 
                ? `Choose content for ${selectedDeviceForAd.name}`
                : 'Choose content to display on all devices'}
            </h4>
            <div className="ad-grid">
              {ads.map((ad) => (
                <div
                  key={ad.id}
                  className={`ad-item ${selectedAd?.id === ad.id ? 'selected' : ''}`}
                  onClick={() => setSelectedAd(ad)}
                >
                  <div className="ad-preview">
                    {ad.type === 'video' ? (
                      <video src={ad.url} className="w-full h-32 object-cover" />
                    ) : (
                      <img src={ad.url} alt={ad.name} className="w-full h-32 object-cover" />
                    )}
                  </div>
                  <p className="mt-2 font-medium">{ad.name}</p>
                  <small className="text-gray-500">{ad.type}</small>
                </div>
              ))}
            </div>
            </div>
            <div className="modal-actions">
              <button className="modal-button primary-button" 
                onClick={selectedDeviceForAd ? confirmDisplayAd : confirmShowAd}>
                Display Ad
              </button>
              <button className="modal-button secondary-button" onClick={() => {
                setIsDisplayModalOpen(false);
                setSelectedDeviceForAd(null);
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Display Stop Confirmation Modal */}
      {isDisplayConfirmModalOpen && selectedDeviceForAd && (
      <div className="modal">
        <div className="modal-content confirm-modal-content">
          <h3 className="modal-title">Stop Display</h3>
          <p>Are you sure you want to stop the current advertisement on {selectedDeviceForAd.name}?</p>
          <div className="modal-actions" style={{ justifyContent: 'center' }}>
            <button className="modal-button danger-button" onClick={confirmStopDisplay}>Stop Display</button>
            <button className="modal-button secondary-button" onClick={() => {
              setIsDisplayConfirmModalOpen(false);
              setSelectedDeviceForAd(null);
            }}>Cancel</button>
          </div>
        </div>
      </div>
      )}

      {/* Remove Confirmation Modal */}
      {isRemoveModalOpen && deviceToRemove && (
        <div className="modal">
          <div className="modal-content confirm-modal-content">
            <h3>Remove Device</h3>
            <p>Are you sure you want to remove {deviceToRemove.name}?</p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="modal-button danger-button" onClick={confirmRemoveDevice}>Remove</button>
              <button className="modal-button secondary-button" onClick={() => {
                setIsRemoveModalOpen(false);
                setDeviceToRemove(null);
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

       {/* Multi-Display Modal */}
       {isMultiDisplayModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3 className="modal-title">Display Ad to Selected Devices</h3>
            <p>Displaying to {selectedDevices.size} device(s)</p>
            
            <div className="ad-selection">
              <h4 className="modal-subtitle">Select an Advertisement</h4>
              <div className="ad-grid" style={{ maxHeight: '300px', overflow: 'auto' }}>
                {ads.map((ad) => (
                  <div
                    key={ad.id}
                    className={`ad-item ${selectedAd?.id === ad.id ? 'selected' : ''}`}
                    onClick={() => setSelectedAd(ad)}
                  >
                    <div className="ad-preview">
                      {ad.type === 'video' ? (
                        <video src={ad.url} className="w-full h-32 object-cover" />
                      ) : (
                        <img src={ad.url} alt={ad.name} className="w-full h-32 object-cover" />
                      )}
                    </div>
                    <p className="mt-2 font-medium">{ad.name}</p>
                    <small className="text-gray-500">{ad.type}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="selected-devices" style={{ marginTop: '20px' }}>
              <h4 className="modal-subtitle">Selected {isDevicesSelected ? 'Devices' : 'Groups'}:</h4>
              <div style={{ maxHeight: '100px', overflow: 'auto' }}>
                {isDevicesSelected ? 
                  Array.from(selectedDevices).map(deviceId => {
                    const device = connectedDevices.find(d => d.socketId === deviceId);
                    return device ? (
                      <div key={deviceId} style={{ padding: '4px 0' }}>
                        {device.name}
                      </div>
                    ) : null;
                  })
                  :
                  Array.from(selectedGroups).map(groupId => {
                    const group = groups.find(g => g.tv_group_id === groupId);
                    return group ? (
                      <div key={groupId} style={{ padding: '4px 0' }}>
                        {group.name} ({group.deviceIds.length} devices)
                      </div>
                    ) : null;
                  })
                }
              </div>
            </div>

            <div>
              <button className="modal-button primary-button" onClick={confirmMultiDisplayAd}>Display Ad</button>
              <button className="modal-button secondary-button" onClick={() => {
                setIsMultiDisplayModalOpen(false);
                setSelectedAd(null);
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Image Modal */}
      {isImageModalOpen && selectedAd && selectedAd.type === 'image' && (
        <div className="full-screen-ad" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#000',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <img
            src={selectedAd.url}
            alt={selectedAd.name}
            style={{
              width: '100vw',
              height: '100vh',
              objectFit: 'cover'
            }}
            onClick={() => setIsImageModalOpen(false)}
          />
        </div>
      )}

      {/* Full-Screen Video Modal */}
      {isVideoModalOpen && selectedAd && selectedAd.type === 'video' && (
        <div className="full-screen-ad">
          <video
            src={selectedAd.url}
            controls
            autoPlay
            loop
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              objectFit: 'cover',
              backgroundColor: '#000',
              zIndex: 1000
            }}
            onClick={() => setIsVideoModalOpen(false)}
          />
        </div>
      )}

      {/* Ad Confirmation Modal */}
      {isAdConfirmModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3>Confirm Ad Display</h3>
            <p>Do you want to display the selected ad?</p>
            <button onClick={confirmShowAd}>Confirm</button>
            <button onClick={() => setIsAdConfirmModalOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add Device Modal */}
      {isAddDeviceModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3 className="modal-title">Add Device</h3>
            
            {/* Available Devices Section */}
            <div className="available-devices-section" style={{ marginBottom: '20px' }}>
              <h4 className="modal-subtitle">Available Devices</h4>
              {availableDevices.filter(device => !device.isRegistered).map((device) => (
                <div 
                  key={device.socketId}
                  className={`device-option ${selectedDevice?.socketId === device.socketId ? 'selected' : ''}`}
                  onClick={() => setSelectedDevice(device)}
                  style={{
                    padding: '10px',
                    margin: '5px 0',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    backgroundColor: selectedDevice === device ? '#FFFFFF' : '#f5f5f5',
                    border: '1px solid #ccc',
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>
                    {device.info.device} ({device.info.os})
                  </div>
                  <div style={{ fontSize: '0.8em', color: '#666' }}>
                    Browser: {device.info.browser}
                    <br/>
                    IP: {device.ip}
                    <br/>
                    Last Seen: {new Date(device.lastSeen).toLocaleString()}
                    {device.socketId === socket.id ? ' (This Device)' : ''}
                  </div>
                </div>
              ))}
            </div>

            <div className="custom-name-section">
              <h4 className="modal-subtitle">Device Name</h4>
              <input
                type="text"
                placeholder="Enter custom device name (optional)"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {/* Add Device Button */}
              <button
                className="modal-button primary-button"
                onClick={confirmAddDevice}
                disabled={!selectedDevice} // Disable button if no device is selected
                style={{
                  backgroundColor: !selectedDevice ? '#ccc' : '#6a4fe7', // Gray color for disabled state
                  cursor: !selectedDevice ? 'not-allowed' : 'pointer',  // Pointer cursor only when enabled
                }}
              >
                Add Device
              </button>
              <button className="modal-button secondary-button" onClick={closeAddDeviceModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Group Modal */}
      {isAddGroupModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3 className="modal-title">Create New Group</h3>
            
            <div className="group-name-section" style={{ marginBottom: '20px' }}>
              <h4 className="modal-subtitle">Group Name</h4>
              <input
                type="text"
                placeholder="Enter group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0'
                }}
              />
            </div>
            
            <div className="device-selection">
              <h4 className="modal-subtitle">Select Devices for Group (minimum 2)</h4>
              <div className="device-grid" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {connectedDevices.map((device) => (
                  <div
                    key={device.deviceId}
                    className={`device-option ${selectedGroupDevices.has(device.deviceId) ? 'selected' : ''}`}
                    onClick={() => {
                      const newSelection = new Set(selectedGroupDevices);
                      if (newSelection.has(device.deviceId)) {
                        newSelection.delete(device.deviceId);
                      } else {
                        newSelection.add(device.deviceId);
                      }
                      setSelectedGroupDevices(newSelection);
                    }}
                    style={{
                      padding: '15px',
                      margin: '10px 0',
                      borderRadius: '8px',
                      border: selectedGroupDevices.has(device.deviceId) ? '2px solid #6a4fe7' : '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out',
                      backgroundColor: 'white',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div className="device-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FaTabletAlt />
                      <div>
                        <div style={{ 
                          fontWeight: '600',
                          fontSize: '1.1rem',
                          color: '#2d3748',
                          marginBottom: '4px',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }}>{device.name}</div>
                        <div className={`status-badge ${device.status === 'Connected' ? 'status-connected' : 'status-disconnected'}`}>
                          {device.status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                className="modal-button primary-button" 
                onClick={confirmAddGroup}
                disabled={selectedGroupDevices.size < 2 || !groupName.trim()}
              >
                Create Group
              </button>
              <button className="modal-button secondary-button" onClick={closeAddGroupModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isViewGroupModalOpen && selectedGroup && (
        <div className="modal">
          <div className="modal-content">
            <h3 className="modal-title">Group Devices</h3>
            <h4 className="modal-subtitle">Devices in Group</h4>
            <div className="group-devices-grid" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {selectedGroup.deviceIds.map((deviceId) => {
                const device = connectedDevices.find(d => d.deviceId === deviceId);
                return device ? (
                  <div key={deviceId} className="group-device-item" style={{ padding: '10px', margin: '5px 0', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FaTabletAlt />
                      <div>
                        <div style={{ fontWeight: '600' }}>{device.name}</div>
                        <div className={`status-badge ${device.status === 'Connected' ? 'status-connected' : 'status-disconnected'}`}>
                          {device.status}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null;
              })}
            </div>
            <div className="modal-actions">
              <button className="modal-button secondary-button" onClick={() => setIsViewGroupModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Group Display Stop Confirmation Modal */}
      {isGroupDisplayConfirmModalOpen && selectedGroupForAd && (
        <div className="modal">
          <div className="modal-content confirm-modal-content">
            <h3 className="modal-title">Stop Display</h3>
            <p>Are you sure you want to stop the current advertisement on group {selectedGroupForAd.name}?</p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="modal-button danger-button" onClick={confirmStopGroupDisplay}>Stop Display</button>
              <button className="modal-button secondary-button" onClick={() => {
                setIsGroupDisplayConfirmModalOpen(false);
                setSelectedGroupForAd(null);
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Group Confirmation Modal */}
      {isRemoveGroupModalOpen && groupToRemove && (
        <div className="modal">
          <div className="modal-content confirm-modal-content">
            <h3>Remove Group</h3>
            <p>Are you sure you want to remove {groupToRemove.name}?</p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="modal-button danger-button" onClick={confirmRemoveGroup}>Remove</button>
              <button className="modal-button secondary-button" onClick={() => {
                setIsRemoveGroupModalOpen(false);
                setGroupToRemove(null);
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Devices;