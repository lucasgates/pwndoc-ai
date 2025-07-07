<template>
<div>
    <q-drawer side="left" :value="true">
        <q-list class="home-drawer">
            <q-item-label header>{{$t('handleCustomData')}}</q-item-label>
        
            <q-separator />
            <q-item to='/data/collaborators' v-if="UserService.isAllowed('users:create')">
                
                <q-item-section avatar>
                    <q-icon name="fa fa-users" />
                </q-item-section>
                <q-item-section>{{$t('collaborators')}}</q-item-section>
            </q-item>
            <q-item to='/data/companies' v-if="UserService.isAllowed('companies:update')">
                <q-item-section avatar>
                    <q-icon name="fa fa-building" />
                </q-item-section>
                <q-item-section>{{$t('companies')}}</q-item-section>
            </q-item>
            <q-item to='/data/clients' v-if="UserService.isAllowed('clients:update')">
                <q-item-section avatar>
                    <q-icon name="fa fa-user-tie" />
                </q-item-section>
                <q-item-section>{{$t('clients')}}</q-item-section>
            </q-item>
            <q-item to='/data/templates' v-if="UserService.isAllowed('templates:update')">
                <q-item-section avatar>
                    <q-icon name="fa fa-file-word" />
                </q-item-section>
                <q-item-section>{{$t('templates')}}</q-item-section>
            </q-item>

            <q-separator spaced />

            <q-item to='/data/custom' v-if="UserService.isAllowed('custom-fields:update')">
                <q-item-section avatar>
                    <q-icon name="fa fa-table" />
                </q-item-section>
                <q-item-section>{{$t('customData')}}</q-item-section>
            </q-item>
            <q-item to='/data/dump' v-if="UserService.isAllowed('users:create')">

                <q-item-section avatar>
                    <q-icon name="fa fa-archive" />
                </q-item-section>
                <q-item-section>{{$t('import')}} / {{$t('export')}}</q-item-section>
            </q-item>
        </q-list>
    </q-drawer>
    <router-view />     
</div>
</template>

<script>
import Breadcrumb from 'components/breadcrumb'
import UserService from '@/services/user'

export default {
    data: () => {
        return {
            UserService: UserService
        }
    },

    components: {
        Breadcrumb
    }
}
</script>

