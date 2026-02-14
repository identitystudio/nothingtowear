# Supabase Storage Setup Guide

## Setting up the Storage Bucket

To complete the Supabase integration for image uploads, you need to create a storage bucket in your Supabase project dashboard:

### Step 1: Create Storage Bucket

1. Go to your Supabase dashboard: https://app.supabase.com/project/gbxrmkuwsdruyhbmmyct
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Name it: `closet-images`
5. Set it to **Public** (so images can be accessed via public URLs)
6. Click **Create bucket**

### Important: Configure CORS for Canvas Access

After creating the bucket, you need to enable CORS so the canvas can access images:

1. Go to **Storage** → **Configuration** (or **Settings**)
2. Under **CORS Configuration**, add this allowed origin:
   ```
   *
   ```
   Or specifically: `http://localhost:3000` (for development)
3. Make sure these headers are allowed:
   - `Content-Type`
   - `Authorization`
   - `x-client-info`
4. Save the CORS configuration

**Note**: If you can't find CORS settings in the UI, Supabase public buckets typically have CORS enabled by default. The `crossOrigin="anonymous"` attribute in the code should handle it.

### Step 2: Set Storage Policies (Optional - Skip if using Public Bucket)

**If you created a PUBLIC bucket in Step 1, you're done! Skip to Step 3.**

For private buckets with custom policies, follow these detailed steps:

#### Create Policy 1: Allow Public Read

1. Go to **Storage** → **Policies** tab
2. Click **New Policy** button
3. Choose **"Create a policy from scratch"**
4. Fill in the form (NOT SQL code):
   - **Policy name**: `Public Read Access`
   - **Policy command**: Select **SELECT** from dropdown ✅
   - **Target roles**: `public`
   - **USING expression**: Enter ONLY this → `bucket_id = 'closet-images'`
     - ⚠️ Do NOT paste the full SQL CREATE POLICY statement
     - ⚠️ Only the condition goes here, not the whole SQL
5. Click **Review** → **Save policy**

#### Create Policy 2: Allow Public Upload

1. Click **New Policy** again
2. Choose **"Create a policy from scratch"**
3. Fill in the form:
   - **Policy name**: `Public Upload Access`
   - **Policy command**: Select **INSERT** from dropdown ✅
   - **Target roles**: `public`
   - **WITH CHECK expression**: Enter ONLY this → `bucket_id = 'closet-images'`
4. Click **Review** → **Save policy**

#### Create Policy 3: Allow Public Delete

1. Choose **"Create a policy from scratch"**
3. Fill in the form:
   - **Policy name**: `Public Delete Access`
   - **Policy command**: Select **DELETE** from dropdown ✅
   - **Target roles**: `public`
   - **USING expression**: Enter ONLY this → `bucket_id = 'closet-images'`
4. Click **Review** → **Save policy**

**Important Notes**: 
- ⚠️ **Do NOT paste SQL code** - just fill in the form fields
- Only put the condition `bucket_id = 'closet-images'` in the expression fields
- The full CREATE POLICY SQL is generated automatically
**Note**: Make sure to check at least one operation (SELECT, INSERT, UPDATE, or DELETE) for each policy, otherwise you'll get the error "Please allow at least one operation in your policy".

### Step 3: Test the Integration

1. Run your development server: `npm run dev`
2. Go to the Closet page
3. Upload some clothing images
4. Check your Supabase Storage dashboard to see the uploaded images

## What Changed?

✅ **Environment Variables**: Added Supabase URL and anon key to `.env`
✅ **Supabase Client**: Created `src/lib/supabase-client.ts` for Supabase initialization
✅ **Storage Helper**: Created `src/lib/supabase-storage.ts` with upload/download functions
✅ **Closet Page**: Updated to use Supabase Storage instead of IndexedDB
✅ **Outfits Page**: Updated to fetch images from Supabase Storage

## Benefits of Supabase Storage

- **Cloud Storage**: Images persist across devices and browsers
- **Scalability**: No browser storage limits (IndexedDB had ~50-100MB limit)
- **CDN**: Fast image delivery with Supabase's CDN
- **Backup**: Your images are safely stored in the cloud
- **Sharing**: Easy to share closets between users in the future

## Environment Variables

Your `.env` now includes:
```
NEXT_PUBLIC_SUPABASE_URL="https://gbxrmkuwsdruyhbmmyct.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```
