"use client";

import FormField from "../common/FormField";

/**
 * User form component for create/edit
 *
 * @param {Object} props
 * @param {Object} props.form - Form data
 * @param {Function} props.onChange - Change handler
 * @param {Array} props.roleOptions - Options for the role dropdown
 * @param {boolean} props.isEditMode - Whether form is in edit mode
 */
export default function UserForm({ form, onChange, roleOptions, isEditMode = false }) {
    return (
        <>
            <FormField name="username" label="Username" value={form.username} onChange={onChange} required />

            <FormField name="full_name" label="Full Name" value={form.full_name} onChange={onChange} required />

            <FormField
                name="role"
                label="Role"
                type="select"
                value={form.role}
                onChange={onChange}
                options={roleOptions}
                required
            />

            <FormField
                name="password"
                label="Password"
                type="password"
                value={form.password || ""}
                onChange={onChange}
                required={!isEditMode}
                placeholder={isEditMode ? "Leave blank to keep current password" : ""}
            />
        </>
    );
}
