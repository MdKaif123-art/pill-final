# Security & Privacy Documentation

## Data Collection and Usage

### What Data is Collected

1. **User Account Information**
   - Email address (for authentication)
   - User role (patient or caregiver)
   - Account creation timestamp

2. **Medication Schedule Data**
   - Morning dose time (HH:MM format)
   - Evening dose time (HH:MM format)
   - Initial pill count
   - Current pill count

3. **Dose History**
   - Timestamp of each dose event
   - Dose type (morning/evening)
   - Status (taken/missed)
   - Delay in minutes (if taken late)

4. **Device Status**
   - Online/offline status
   - Last synchronization timestamp

### What Data is NOT Collected

- Personal health information (PHI) beyond adherence data
- Medical conditions or diagnoses
- Prescription details
- Location data
- Biometric information

## Data Access Control

### Role-Based Access

**Patient Role:**
- Can view their own dose history
- Can view their own settings (read-only)
- Cannot modify dose times or pill count
- Cannot access other patients' data

**Caregiver Role:**
- Can view patient adherence data
- Can update patient settings (dose times, pill count)
- Can view patient dose history
- Cannot access other caregivers' patients (in current implementation)

### Security Rules

Firestore security rules enforce:
- Users can only read their own user document
- Patients can only access their own settings and logs
- Caregivers can read/write patient settings
- Dose logs are immutable after creation

## Data Protection

### Encryption

- **In Transit**: All data encrypted using TLS/HTTPS
- **At Rest**: Firebase encrypts all data at rest
- **Authentication**: Firebase Authentication uses industry-standard encryption

### Access Control

- **Authentication Required**: All data access requires valid Firebase Authentication
- **Token-Based**: Firebase uses secure tokens for authentication
- **Role Verification**: Server-side security rules verify user roles

### Data Storage

- **Firebase Infrastructure**: Data stored on Google Cloud Platform
- **Geographic Location**: Data stored in Firebase project region
- **Backup**: Firebase provides automatic backups

## Data Retention

- **Dose Logs**: Retained indefinitely (can be configured for deletion)
- **User Accounts**: Retained until account deletion
- **Settings**: Retained until account deletion

## User Rights

### Right to Access
Users can view all their data through the dashboard.

### Right to Delete
Users can request account deletion, which will remove:
- User account
- Associated settings
- Dose history (if configured)

### Right to Correction
Users (caregivers) can update medication settings at any time.

## Compliance Considerations

### HIPAA (Health Insurance Portability and Accountability Act)

**Current Status**: This is a demonstration project and is NOT HIPAA compliant.

**For Production Healthcare Use:**
1. **Business Associate Agreement (BAA)**: Required with Firebase/Google Cloud
2. **Enhanced Security**: Additional encryption, audit logging
3. **Access Controls**: More granular role-based access
4. **Audit Trails**: Comprehensive logging of all data access
5. **Patient Consent**: Explicit consent management system
6. **Data Minimization**: Collect only necessary data
7. **Breach Notification**: Procedures for data breach response

### GDPR (General Data Protection Regulation)

**For EU Users:**
- Right to access data
- Right to data portability
- Right to erasure
- Data processing transparency
- Consent management

## Security Best Practices

### For Developers

1. **Never commit secrets**: Use environment variables
2. **Keep dependencies updated**: Regularly update npm packages
3. **Review security rules**: Regularly audit Firestore rules
4. **Monitor access**: Review Firebase logs for suspicious activity
5. **Use strong passwords**: Enforce password policies

### For Users

1. **Use strong passwords**: Minimum 8 characters, mix of letters/numbers
2. **Don't share accounts**: Each user should have their own account
3. **Logout when done**: Especially on shared devices
4. **Report issues**: Contact support for security concerns

## Incident Response

### Data Breach Procedure

1. **Immediate**: Assess scope of breach
2. **Containment**: Revoke compromised credentials
3. **Notification**: Notify affected users
4. **Investigation**: Determine cause and fix
5. **Documentation**: Document incident and response

## Third-Party Services

### Firebase/Google Cloud

- **Data Processing**: Firebase processes data on behalf of the application
- **Location**: Data stored in Firebase project region
- **Compliance**: Google Cloud maintains various compliance certifications
- **Privacy Policy**: [Google Privacy Policy](https://policies.google.com/privacy)

## Contact

For security concerns or data access requests, contact the development team.

---

**Last Updated**: 2024
**Version**: 1.0

