import * as Notifications from 'expo-notifications';

export function useAutoSync() {
  // Request notification permissions on app start
  const requestPermissions = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('Current notification permission status:', existingStatus);
      
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        console.log('Requesting notification permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('Permission request result:', status);
      }
      
      if (finalStatus !== 'granted') {
        console.warn('Notification permissions not granted. Status:', finalStatus);
      } else {
        console.log('Notification permissions granted successfully');
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
    }
  };

  requestPermissions();
}
