/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Schemas } from 'vs/base/common/network';
import { IExtensionManagementServer, IExtensionManagementServerService } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { ExtensionManagementChannelClient } from 'vs/platform/extensionManagement/common/extensionManagementIpc';
import { IRemoteAgentService } from 'vs/workbench/services/remote/common/remoteAgentService';
import { REMOTE_HOST_SCHEME } from 'vs/platform/remote/common/remoteHosts';
import { IChannel } from 'vs/base/parts/ipc/common/ipc';
import { ISharedProcessService } from 'vs/platform/ipc/electron-browser/sharedProcessService';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { DesktopRemoteExtensionManagementService } from 'vs/workbench/services/extensionManagement/electron-browser/remoteExtensionManagementService';
import { ILabelService } from 'vs/platform/label/common/label';
import { IExtension } from 'vs/platform/extensions/common/extensions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class ExtensionManagementServerService implements IExtensionManagementServerService {

	declare readonly _serviceBrand: undefined;

	private readonly _localExtensionManagementServer: IExtensionManagementServer;
	public get localExtensionManagementServer(): IExtensionManagementServer { return this._localExtensionManagementServer; }
	readonly remoteExtensionManagementServer: IExtensionManagementServer | null = null;
	readonly webExtensionManagementServer: IExtensionManagementServer | null = null;

	constructor(
		@ISharedProcessService sharedProcessService: ISharedProcessService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IRemoteAgentService remoteAgentService: IRemoteAgentService,
		@ILabelService labelService: ILabelService,
	) {
		const localExtensionManagementService = new ExtensionManagementChannelClient(sharedProcessService.getChannel('extensions'));

		this._localExtensionManagementServer = { extensionManagementService: localExtensionManagementService, id: 'local', label: localize('local', "Local") };
		const remoteAgentConnection = remoteAgentService.getConnection();
		if (remoteAgentConnection) {
			const extensionManagementService = instantiationService.createInstance(DesktopRemoteExtensionManagementService, remoteAgentConnection.getChannel<IChannel>('extensions'), this.localExtensionManagementServer);
			this.remoteExtensionManagementServer = {
				id: 'remote',
				extensionManagementService,
				get label() { return labelService.getHostLabel(REMOTE_HOST_SCHEME, remoteAgentConnection!.remoteAuthority) || localize('remote', "Remote"); }
			};
		}
	}

	getExtensionManagementServer(extension: IExtension): IExtensionManagementServer {
		if (extension.location.scheme === Schemas.file) {
			return this.localExtensionManagementServer;
		}
		if (this.remoteExtensionManagementServer && extension.location.scheme === REMOTE_HOST_SCHEME) {
			return this.remoteExtensionManagementServer;
		}
		throw new Error(`Invalid Extension ${extension.location}`);
	}
}

registerSingleton(IExtensionManagementServerService, ExtensionManagementServerService);
