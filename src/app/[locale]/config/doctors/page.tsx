'use client';

import { DOCTORS_DIRECTORY_CONFIG, StaffDirectory } from '@/components/config/staff-directory';

export default function DoctorsPage() {
    return <StaffDirectory config={DOCTORS_DIRECTORY_CONFIG} />;
}
