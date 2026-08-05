import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UsersSecurityView from './security/UsersSecurityView';
import InvitationsSecurityView from './security/InvitationsSecurityView';
import RolesSecurityView from './security/RolesSecurityView';
import PermissionsSecurityView from './security/PermissionsSecurityView';
import DataScopesSecurityView from './security/DataScopesSecurityView';

export default function SecurityManager() {
  const { securityId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!securityId || securityId === 'access-assignments') {
      navigate('/settings/security/users', { replace: true });
    }
  }, [securityId, navigate]);

  return (
    <div className="flex h-[calc(100vh-64px)] w-full -m-6 relative overflow-hidden">
      <main className="flex-1 overflow-y-auto bg-[var(--bg-color)] relative flex flex-col h-full custom-scrollbar w-full">
        {securityId === 'users' ? (
          <UsersSecurityView />
        ) : securityId === 'invitations' ? (
          <InvitationsSecurityView />
        ) : securityId === 'roles' ? (
          <RolesSecurityView />
        ) : securityId === 'permissions' ? (
          <PermissionsSecurityView />
        ) : securityId === 'data-scopes' ? (
          <DataScopesSecurityView />
        ) : null}
      </main>
    </div>
  );
}
