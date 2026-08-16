import React, { useState, useRef } from 'react';
import {
  Box,
  Image,
  Text,
  ActionIcon,
  LoadingOverlay,
  Paper,
  Center,
  Stack,
  Avatar
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Upload, X, Camera, ImageIcon } from 'lucide-react';
import { api } from '../../lib/api';
import { notifications } from '@mantine/notifications';

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder: 'agencies' | 'avatars' | 'airlines' | 'hotels' | 'rooms' | 'pilgrims';
  size?: number;
  radius?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  placeholder?: string;
  variant?: 'default' | 'avatar' | 'card';
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  folder,
  size = 120,
  radius = 'md',
  placeholder,
  variant = 'default',
  disabled = false
}: ImageUploadProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      notifications.show({
        title: t('error') || 'Error',
        message: t('invalid_image_type') || 'Invalid image type. Please use JPEG, PNG, GIF, or WebP.',
        color: 'red'
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      notifications.show({
        title: t('error') || 'Error',
        message: t('image_too_large') || 'Image is too large. Maximum size is 5MB.',
        color: 'red'
      });
      return;
    }

    setLoading(true);
    try {
      const result = await api.uploadFile(folder, file);
      onChange(result.url);
      notifications.show({
        title: t('success') || 'Success',
        message: t('image_uploaded') || 'Image uploaded successfully',
        color: 'green'
      });
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'Error',
        message: error.message || t('upload_failed') || 'Failed to upload image',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    onChange(null);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  // Avatar variant
  if (variant === 'avatar') {
    return (
      <Box pos="relative" style={{ display: 'inline-block' }}>
        <LoadingOverlay visible={loading} loaderProps={{ size: 'sm' }} />
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
        <Avatar
          src={value}
          size={size}
          radius="xl"
          style={{ cursor: disabled ? 'default' : 'pointer' }}
          onClick={handleClick}
        >
          {placeholder?.[0]?.toUpperCase() || <Camera size={size / 3} />}
        </Avatar>
        {value && !disabled && (
          <ActionIcon
            size="xs"
            color="red"
            variant="filled"
            radius="xl"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              zIndex: 10
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
          >
            <X size={12} />
          </ActionIcon>
        )}
        {!value && !disabled && (
          <ActionIcon
            size="xs"
            color="teal"
            variant="filled"
            radius="xl"
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              zIndex: 10
            }}
            onClick={handleClick}
          >
            <Camera size={12} />
          </ActionIcon>
        )}
      </Box>
    );
  }

  // Card variant (for hotels, rooms)
  if (variant === 'card') {
    return (
      <Paper
        pos="relative"
        w={size}
        h={size * 0.75}
        radius={radius}
        style={{
          overflow: 'hidden',
          cursor: disabled ? 'default' : 'pointer',
          border: dragActive ? '2px dashed #0C7774' : '1px solid #E2D9C8',
          backgroundColor: dragActive ? '#E7F3F2' : '#F8F6F0'
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <LoadingOverlay visible={loading} />
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
        {value ? (
          <>
            <Image
              src={value}
              w="100%"
              h="100%"
              fit="cover"
            />
            {!disabled && (
              <ActionIcon
                size="sm"
                color="red"
                variant="filled"
                radius="xl"
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  zIndex: 10
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
              >
                <X size={14} />
              </ActionIcon>
            )}
          </>
        ) : (
          <Center h="100%">
            <Stack align="center" gap={4}>
              <ImageIcon size={24} color="#0C7774" />
              <Text size="xs" c="dimmed">
                {placeholder || t('click_to_upload') || 'Click to upload'}
              </Text>
            </Stack>
          </Center>
        )}
      </Paper>
    );
  }

  // Default variant (square logo upload)
  return (
    <Paper
      pos="relative"
      w={size}
      h={size}
      radius={radius}
      style={{
        overflow: 'hidden',
        cursor: disabled ? 'default' : 'pointer',
        border: dragActive ? '2px dashed #0C7774' : '1px solid #E2D9C8',
        backgroundColor: dragActive ? '#E7F3F2' : '#F8F6F0'
      }}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <LoadingOverlay visible={loading} />
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />
      {value ? (
        <>
          <Image
            src={value}
            w="100%"
            h="100%"
            fit="contain"
            style={{ padding: 8 }}
          />
          {!disabled && (
            <ActionIcon
              size="sm"
              color="red"
              variant="filled"
              radius="xl"
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                zIndex: 10
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
            >
              <X size={14} />
            </ActionIcon>
          )}
        </>
      ) : (
        <Center h="100%">
          <Stack align="center" gap={4}>
            <Upload size={24} color="#0C7774" />
            <Text size="xs" c="dimmed" ta="center" px="xs">
              {placeholder || t('click_or_drag') || 'Click or drag image'}
            </Text>
          </Stack>
        </Center>
      )}
    </Paper>
  );
}
